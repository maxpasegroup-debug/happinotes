const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
function stubDistModule(relativePath, exports) {
  const resolved = require.resolve(relativePath);
  const module = new Module(resolved);
  module.filename = resolved;
  module.loaded = true;
  module.exports = exports;
  require.cache[resolved] = module;
}
stubDistModule('../dist/services/storeProductProvisioning', { ensureBookProducts: async () => null, validatePremiumPrice: () => {} });
stubDistModule('../dist/services/realtime', { emitCatalogChanged: () => {} });
stubDistModule('../dist/services/catalogNotification', { notifyCatalogUsers: async () => {} });
const controller = require('../dist/controllers/adminContentController');
const { Content } = require('../dist/models');
const cloudinaryConfig = require('../dist/config/cloudinary');
const provisioning = require('../dist/services/storeProductProvisioning');
const realtime = require('../dist/services/realtime');

afterEach(() => mock.restoreAll());

function coverFile() {
  return { originalname: 'cover.jpg', mimetype: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]) };
}
function mp3File(name) {
  return { originalname: name, mimetype: 'audio/mpeg', buffer: Buffer.concat([Buffer.from('ID3\x04\x00\x00\x00\x00\x00\x00', 'binary'), Buffer.from([0xff, 0xfb, 0x90, 0x64, 0x00, 0x00])]) };
}
function request({ title = 'A HappiNotes book', status = 'draft', lessons = [], lessonFiles = [], indexes = [] } = {}) {
  return {
    body: {
      title, description: 'A short description', language: 'English', contentType: 'lifebook',
      type: 'free', priceInr: '0', status, featured: 'false',
      lessons: JSON.stringify(lessons), lessonMediaIndexes: JSON.stringify(indexes),
    },
    files: { thumbnail: [coverFile()], lessonMedia: lessonFiles },
    protocol: 'https', get: () => 'happinotes.online',
  };
}
function response() {
  return {
    statusCode: 200, payload: undefined,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
}
function commonMocks({ failAt } = {}) {
  let uploads = 0;
  const uploaded = [];
  mock.method(cloudinaryConfig, 'isCloudinaryConfigured', () => true);
  mock.method(cloudinaryConfig, 'configureCloudinary', () => {});
  mock.method(cloudinaryConfig.cloudinary.uploader, 'upload_stream', (options, callback) => ({
    on() { return this; },
    destroy() {},
    end() {
      uploads += 1;
      if (uploads === failAt) callback(new Error('provider detail must stay private'));
      else {
        const asset = { secure_url: `https://media.example/${uploads}`, public_id: `test/asset-${uploads}`, resource_type: options.resource_type };
        uploaded.push(asset);
        callback(null, asset);
      }
    },
  }));
  const destroyed = [];
  mock.method(cloudinaryConfig.cloudinary.uploader, 'destroy', async (id) => { destroyed.push(id); return { result: 'ok' }; });
  mock.method(provisioning, 'ensureBookProducts', async () => null);
  mock.method(realtime, 'emitCatalogChanged', () => {});
  return { uploaded, destroyed };
}
async function callCreate(req) {
  const res = response(); let error;
  await controller.createContent(req, res, (value) => { error = value; });
  return { res, error };
}

test('creates a draft with a valid image, MP3, and multiple ordered lessons', async () => {
  commonMocks();
  let saved;
  mock.method(Content, 'create', async (value) => { saved = value; return { ...value, id: 'book-1' }; });
  const lessons = [
    { title: 'First lesson', description: '', mediaType: 'audio', order: 0 },
    { title: 'Second lesson', description: '', mediaType: 'audio', order: 1 },
  ];
  const { res, error } = await callCreate(request({ lessons, lessonFiles: [mp3File('one.mp3'), mp3File('two.mp3')], indexes: [0, 1] }));
  assert.equal(error, undefined);
  assert.equal(res.statusCode, 201);
  assert.equal(saved.lessons.length, 2);
  assert.deepEqual(saved.lessons.map((lesson) => lesson.order), [0, 1]);
  assert.ok(saved.thumbnailUrl);
  assert.ok(saved.lessons.every((lesson) => lesson.mediaUrl && lesson.mediaType === 'audio'));
});

test('rejects executable lesson media before storing anything', async () => {
  const uploads = commonMocks();
  const create = mock.method(Content, 'create', async () => { throw new Error('must not create'); });
  const badExe = { originalname: 'installer.exe', mimetype: 'audio/mpeg', buffer: Buffer.from('MZ executable') };
  const { error } = await callCreate(request({ lessons: [{ title: 'Episode', mediaType: 'audio' }], lessonFiles: [badExe], indexes: [0] }));
  assert.equal(error.statusCode, 400);
  assert.match(error.message, /MP3/);
  assert.equal(uploads.uploaded.length, 0);
  assert.equal(create.mock.calls.length, 0);
});

test('returns clear validation errors for missing title, cover, or live lesson audio', async () => {
  commonMocks();
  const titleResult = await callCreate(request({ title: ' ' }));
  assert.equal(titleResult.error.statusCode, 400);
  assert.match(titleResult.error.message, /title is required/);

  const noCover = request(); delete noCover.files.thumbnail;
  const coverResult = await callCreate(noCover);
  assert.equal(coverResult.error.statusCode, 400);
  assert.match(coverResult.error.message, /thumbnail file is required/);

  const audioResult = await callCreate(request({ status: 'live', lessons: [{ title: 'Episode' }] }));
  assert.equal(audioResult.error.statusCode, 400);
  assert.match(audioResult.error.message, /MP3 audio file/);
});

test('storage failure returns a safe recovery error and cleans the new cover asset', async () => {
  const assets = commonMocks({ failAt: 2 });
  mock.method(Content, 'create', async () => { throw new Error('must not persist'); });
  const { error } = await callCreate(request({ lessons: [{ title: 'Episode', mediaType: 'audio' }], lessonFiles: [mp3File('episode.mp3')], indexes: [0] }));
  assert.equal(error.statusCode, 503);
  assert.match(error.message, /temporarily unavailable/);
  assert.doesNotMatch(error.message, /provider detail|credential|secret/i);
  assert.deepEqual(assets.destroyed, ['test/asset-1']);
});

test('publish status refuses a book with missing audio and accepts complete lessons', async () => {
  const incomplete = { _id: 'book-2', contentType: 'lifebook', lessons: [{ title: 'Episode', mediaUrl: '' }] };
  mock.method(Content, 'findById', async () => incomplete);
  const update = mock.method(Content, 'findByIdAndUpdate', async (_id, changes) => ({ ...incomplete, ...changes }));
  const next = [];
  await controller.updateContentStatus({ params: { id: 'book-2' }, body: { status: 'live' } }, response(), (error) => next.push(error));
  assert.equal(next[0].statusCode, 400);
  assert.equal(update.mock.calls.length, 0);

  mock.restoreAll();
  commonMocks();
  const complete = { _id: 'book-2', contentType: 'lifebook', status: 'draft', lessons: [{ title: 'Episode', mediaUrl: 'https://media.example/episode.mp3', mediaType: 'audio' }] };
  mock.method(Content, 'findById', async () => complete);
  mock.method(Content, 'findByIdAndUpdate', async (_id, changes) => ({ ...complete, ...changes }));
  const res = response();
  await controller.updateContentStatus({ params: { id: 'book-2' }, body: { status: 'live' }, protocol: 'https', get: () => 'happinotes.online' }, res, (error) => { throw error; });
  assert.equal(res.payload.content.status, 'live');

  mock.restoreAll();
  commonMocks();
  const liveBook = { ...complete, status: 'live' };
  mock.method(Content, 'findById', async () => liveBook);
  mock.method(Content, 'findByIdAndUpdate', async (_id, changes) => ({ ...liveBook, ...changes }));
  const unpublished = response();
  await controller.updateContentStatus({ params: { id: 'book-2' }, body: { status: 'draft' }, protocol: 'https', get: () => 'happinotes.online' }, unpublished, (error) => { throw error; });
  assert.equal(unpublished.payload.content.status, 'draft');
});

test('editing book details preserves every existing lesson when no replacement file is selected', async () => {
  commonMocks();
  const lessons = [
    { title: 'Keep one', description: 'First', mediaUrl: 'https://media.example/one.mp3', mediaType: 'audio', order: 0 },
    { title: 'Keep two', description: 'Second', mediaUrl: 'https://media.example/two.mp3', mediaType: 'audio', order: 1 },
  ];
  const existing = { _id: 'book-edit', id: 'book-edit', contentType: 'lifebook', type: 'free', priceInr: 0, status: 'draft', lessons, title: 'Old title' };
  mock.method(Content, 'findById', async () => existing);
  let update;
  mock.method(Content, 'findByIdAndUpdate', async (_id, payload) => { update = payload; return { ...existing, ...payload }; });
  const req = {
    params: { id: 'book-edit' }, body: { title: 'Updated title', contentType: 'lifebook', type: 'free', lessons: JSON.stringify(lessons) },
    files: {}, protocol: 'https', get: () => 'happinotes.online',
  };
  const res = response(); let error;
  await controller.updateContent(req, res, (value) => { error = value; });
  assert.equal(error, undefined);
  assert.equal(update.lessons.length, 2);
  assert.equal(update.lessons[0].mediaUrl, lessons[0].mediaUrl);
  assert.equal(update.lessons[1].mediaUrl, lessons[1].mediaUrl);
  assert.equal(res.payload.content.title, 'Updated title');
});

test('public book listing asks MongoDB only for live and coming-soon content', async () => {
  const publicController = require('../dist/controllers/contentController');
  let query;
  mock.method(Content, 'find', (filter) => {
    query = filter;
    return { lean: async () => [
      { _id: 'live', title: 'Live', status: 'live', type: 'free', contentType: 'lifebook', lessons: [] },
      { _id: 'soon', title: 'Soon', status: 'coming_soon', type: 'free', contentType: 'lifebook' },
    ] };
  });
  const res = response();
  await publicController.getContents({ query: {}, user: undefined }, res, (error) => { throw error; });
  assert.deepEqual(query.status, { $in: ['live', 'coming_soon'] });
  assert.deepEqual(res.payload.contents.map((book) => book.id.toString()), ['live', 'soon']);
});
