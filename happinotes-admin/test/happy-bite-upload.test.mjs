import { test } from 'node:test';
import assert from 'node:assert/strict';
import { uploadHappyBiteChunks } from '../lib/happy-bite-upload.ts';
const chunk = 6 * 1024 * 1024;
const ticket = { cloudName: 'test-cloud', apiKey: 'public-key', signature: 'test-signature', params: { timestamp: 1, public_id: 'happinotes/happy-bites/audio/test', overwrite: false, allowed_formats: 'mp3' } };
const complete = { done: true, secure_url: 'https://res.cloudinary.com/test-cloud/video/upload/test.mp3', public_id: ticket.params.public_id, duration: 7500, format: 'mp3' };
function setup(t, responses) {
  const instances = [];
  const original = globalThis.XMLHttpRequest;
  globalThis.XMLHttpRequest = class {
    upload = {}; headers = {};
    constructor() { instances.push(this); }
    open(method, url) { this.method = method; this.url = url; }
    setRequestHeader(name, value) { this.headers[name] = value; }
    abort() { this.onabort(); }
    send(form) {
      this.form = form;
      queueMicrotask(() => {
        this.upload.onprogress({ lengthComputable: true, loaded: 1, total: 2 });
        this.upload.onload();
        const response = responses.shift();
        assert.ok(response, 'unexpected request');
        if (response === 'network') { this.onerror(); return; }
        this.status = response.status || 200;
        this.responseText = JSON.stringify(response.body);
        this.onload();
      });
    }
  };
  t.after(() => { if (original === undefined) delete globalThis.XMLHttpRequest; else globalThis.XMLHttpRequest = original; });
  return instances;
}
function file(size = 100) { return new File([new Uint8Array(size)], 'large.mp3', { type: 'audio/mpeg' }); }

test('sequential slices preserve ranges, upload ID, progress and long duration without exposing the admin token', async t => {
  const requests = setup(t, [{ body: { done: false } }, { body: { done: false } }, { body: complete }]);
  const progress = [];
  const source = file(chunk * 2 + 100);
  const result = await uploadHappyBiteChunks(source, ticket, value => progress.push(value));
  assert.equal(result.durationSeconds, 7500);
  assert.equal(requests.length, 3);
  assert.deepEqual(requests.map(r => r.headers['Content-Range']), [`bytes 0-${chunk - 1}/${source.size}`, `bytes ${chunk}-${2 * chunk - 1}/${source.size}`, `bytes ${2 * chunk}-${source.size - 1}/${source.size}`]);
  assert.equal(new Set(requests.map(r => r.headers['X-Unique-Upload-Id'])).size, 1);
  assert.deepEqual(requests.map(r => r.form.get('file').size), [chunk, chunk, 100]);
  for (const request of requests) {
    assert.equal(request.headers.Authorization, undefined);
    assert.equal(request.url, 'https://api.cloudinary.com/v1_1/test-cloud/video/upload');
    assert.equal(request.form.get('overwrite'), 'false');
    assert.equal(request.form.get('allowed_formats'), 'mp3');
  }
  assert.equal(progress.at(-1), 100);
  assert.ok(progress.slice(0, -2).every(value => value < 100));
});

test('transient failure retries the same range before advancing to the next chunk', async t => {
  const requests = setup(t, [{ status: 503, body: {} }, { body: complete }]);
  await uploadHappyBiteChunks(file(), ticket, () => {});
  assert.equal(requests.length, 2);
  assert.equal(requests[0].headers['X-Unique-Upload-Id'], requests[1].headers['X-Unique-Upload-Id']);
  assert.equal(requests[0].headers['Content-Range'], requests[1].headers['Content-Range']);
});

test('provider size and quota errors are actionable and do not automatically retry', async t => {
  const requests = setup(t, [{ status: 400, body: { error: { message: 'File size too large' } } }, { status: 420, body: { error: { message: 'Storage quota exceeded' } } }]);
  await assert.rejects(uploadHappyBiteChunks(file(), ticket, () => {}), /per-file audio\/video limit/);
  await assert.rejects(uploadHappyBiteChunks(file(), ticket, () => {}), /usage allowance/);
  assert.equal(requests.length, 2);
  assert.notEqual(requests[0].headers['X-Unique-Upload-Id'], requests[1].headers['X-Unique-Upload-Id']);
});

test('cancelled uploads never send chunks', async t => {
  const requests = setup(t, []);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(uploadHappyBiteChunks(file(), ticket, () => {}, controller.signal), { name: 'AbortError' });
  assert.equal(requests.length, 0);
});

test('only a completed MP3 matching the signed asset is accepted', async t => {
  setup(t, [{ body: { ...complete, public_id: 'another-asset' } }, { body: { ...complete, format: 'mp4' } }, { body: { ...complete, done: false } }]);
  for (let i = 0; i < 3; i++) await assert.rejects(uploadHappyBiteChunks(file(), ticket, () => {}), /did not confirm/);
});
