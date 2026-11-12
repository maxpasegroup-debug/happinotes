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

function storageMock({ fail = false } = {}) {
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
        if (fail) callback(new Error('Private provider details'));
        done();
      },
      final(done) {
        if (!fail) callback(null, { secure_url: 'https://media.test/bite.mp3', public_id: 'bite', duration: 123.6 });
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
