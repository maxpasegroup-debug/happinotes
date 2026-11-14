const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, open, writeFile, access, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { Readable, Writable } = require('node:stream');
const config = require('../dist/config/cloudinary');
const { uploadHappyBiteAudio } = require('../dist/controllers/happyBiteAudioUploadController');
const { happyBiteAudioUpload, upload } = require('../dist/middleware/upload');
const { validateAudioFile } = require('../dist/utils/mediaValidation');

afterEach(() => mock.restoreAll());

async function stagedFile(t, size = 16, header = Buffer.from([0xff, 0xfb, 0x90, 0x64])) {
  const dir = await mkdtemp(path.join(tmpdir(), 'happy-bite-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const filePath = path.join(dir, 'audio');
  const file = await open(filePath, 'w');
  await file.write(header);
  await file.truncate(size);
  await file.close();
  return { path: filePath, originalname: 'bite.mp3', mimetype: 'audio/mpeg', size };
}

async function call(file) {
  const result = {};
  await uploadHappyBiteAudio({ file }, {
    status(value) { result.status = value; return this; },
    json(value) { result.body = value; },
  }, error => { result.error = error; });
  return result;
}

function storageMock({ fail = false, providerError = new Error('Private provider details'), duration = 123.6 } = {}) {
  let transferred = 0;
  mock.method(config, 'isCloudinaryConfigured', () => true);
  mock.method(config, 'configureCloudinary', () => {});
  mock.method(config.cloudinary.uploader, 'upload_chunked_stream', (options, callback) => {
    assert.equal(options.resource_type, 'video');
    assert.equal(options.folder, 'happinotes/happy-bites/audio');
    assert.equal(options.chunk_size, 6 * 1024 * 1024);
    return new Writable({
      write(chunk, _encoding, done) {
        transferred += chunk.length;
        if (fail) callback(providerError);
        done();
      },
      final(done) {
        if (!fail) callback(null, { secure_url: 'https://media.test/bite.mp3', public_id: 'bite', duration });
        done();
      },
    });
  });
  return () => transferred;
}

test('Happy Bites uploader accepts over 50 MB while the existing uploader keeps its cap', async (t) => {
  assert.equal(upload.limits.fileSize, 50 * 1024 * 1024);
  assert.equal(happyBiteAudioUpload.limits.fileSize, undefined);
  const size = 51 * 1024 * 1024;
  const prefix = Buffer.from('--test-boundary\r\nContent-Disposition: form-data; name="media"; filename="bite.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n');
  const suffix = Buffer.from('\r\n--test-boundary--\r\n');
  const chunk = Buffer.alloc(64 * 1024);
  const req = Readable.from((function* () {
    yield prefix;
    for (let sent = 0; sent < size; sent += chunk.length) yield chunk;
    yield suffix;
  })());
  req.headers = { 'content-type': 'multipart/form-data; boundary=test-boundary', 'content-length': String(prefix.length + size + suffix.length) };
  await new Promise((resolve, reject) => happyBiteAudioUpload.single('media')(req, {}, error => error ? reject(error) : resolve()));
  t.after(() => rm(req.file.path, { force: true }));
  assert.equal(req.file.size, size);
  assert.equal(req.file.buffer, undefined);
});

test('larger MP3 streams to chunked storage and its temporary file is deleted', async (t) => {
  const file = await stagedFile(t, 51 * 1024 * 1024);
  const bytes = storageMock();
  const result = await call(file);
  assert.equal(result.error, undefined);
  assert.equal(result.status, 201);
  assert.equal(result.body.durationSeconds, 124);
  assert.equal(bytes(), file.size);
  await assert.rejects(access(file.path), { code: 'ENOENT' });
});

test('invalid MP3 and storage failures clean up staged files', async (t) => {
  const invalid = await stagedFile(t, 16, Buffer.from('not audio'));
  const rejected = await call(invalid);
  assert.match(rejected.error.message, /valid MP3/);
  await assert.rejects(access(invalid.path), { code: 'ENOENT' });
  const file = await stagedFile(t);
  storageMock({ fail: true });
  const failed = await call(file);
  assert.equal(failed.error.statusCode, 503);
  assert.ok(!failed.error.message.includes('Private provider'));
  await assert.rejects(access(file.path), { code: 'ENOENT' });
});

test('bounded MP3 validation supports large ID3 tags and rejects truncated tags', async (t) => {
  const file = await stagedFile(t, 10020);
  const header = Buffer.from([73, 68, 51, 4, 0, 0, 0, 0, 78, 16]); // 10,000-byte tag
  const handle = await open(file.path, 'r+');
  await handle.write(header, 0, header.length, 0);
  await handle.write(Buffer.from([0xff, 0xfb, 0x90, 0x64]), 0, 4, 10010);
  await handle.close();
  assert.equal(await validateAudioFile(file), null);
  await writeFile(file.path, header);
  assert.match(await validateAudioFile(file), /valid MP3/);
});


test('two-hour-plus audio has no duration cap and streams without buffering the whole file', async (t) => {
  const file = await stagedFile(t, 160 * 1024 * 1024);
  const bytes = storageMock({ duration: 7500 });
  const result = await call(file);
  assert.equal(result.status, 201);
  assert.equal(result.body.durationSeconds, 7500);
  assert.equal(bytes(), file.size);
  await assert.rejects(access(file.path), { code: 'ENOENT' });
});

for (const [providerError, status, message] of [
  [{ http_code: 400, message: 'File size too large. Private provider details' }, 413, /per-file upload limit/],
  [{ http_code: 413, message: 'Private provider details' }, 413, /per-file upload limit/],
  [{ http_code: 420, message: 'Storage quota exceeded Private provider details' }, 503, /usage allowance/],
  [{ http_code: 499, message: 'Request Timeout Private provider details' }, 504, /timed out/],
]) {
  test(`storage failure reports an actionable safe category (${status}, ${providerError.http_code})`, async (t) => {
    const file = await stagedFile(t);
    storageMock({ fail: true, providerError });
    const result = await call(file);
    assert.equal(result.error.statusCode, status);
    assert.match(result.error.message, message);
    assert.ok(!result.error.message.includes('Private provider details'));
    await assert.rejects(access(file.path), { code: 'ENOENT' });
  });
}

test('direct-upload signature restricts format, public ID and overwrite, and never returns the secret', async (t) => {
  const { signHappyBiteAudioUpload } = require('../dist/controllers/happyBiteAudioUploadController');
  const names = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
  const previous = names.map(name => process.env[name]);
  names.forEach((name, index) => { process.env[name] = ['test-cloud', 'test-public-key', 'test-private-secret'][index]; });
  t.after(() => names.forEach((name, index) => { if (previous[index] === undefined) delete process.env[name]; else process.env[name] = previous[index]; }));
  mock.method(config, 'configureCloudinary', () => {});
  const result = {};
  await signHappyBiteAudioUpload({ body: { name: 'long.mp3', type: 'audio/mpeg', size: 500 * 1024 * 1024, public_id: 'victim', overwrite: true } }, {
    setHeader(name, value) { result[name] = value; }, json(body) { result.body = body; },
  }, error => { result.error = error; });
  assert.equal(result.error, undefined);
  assert.equal(result.body.params.allowed_formats, 'mp3');
  assert.equal(result.body.params.overwrite, false);
  assert.match(result.body.params.public_id, /^happinotes\/happy-bites\/audio\/[0-9a-f-]{36}$/);
  assert.equal(result['Cache-Control'], 'private, no-store');
  assert.equal(JSON.stringify(result.body).includes('test-private-secret'), false);
  assert.equal(result.body.signature, config.cloudinary.utils.api_sign_request(result.body.params, 'test-private-secret'));
});

test('direct-upload signing rejects empty and non-MP3 files without issuing credentials', async () => {
  const { signHappyBiteAudioUpload } = require('../dist/controllers/happyBiteAudioUploadController');
  for (const body of [{}, { name: 'video.mp4', size: 10 }, { name: 'bad.mp3', type: 'video/mp4', size: 10 }, { name: 'empty.mp3', size: 0 }]) {
    let error;
    await signHappyBiteAudioUpload({ body }, { json() { assert.fail('invalid input was signed'); } }, value => { error = value; });
    assert.equal(error.statusCode, 400);
  }
});
