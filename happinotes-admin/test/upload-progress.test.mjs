import { test } from 'node:test';
import assert from 'node:assert/strict';
import { uploadMultipart } from '../lib/api.ts';

test('upload reports transfer completion but waits for the server response before resolving', async (t) => {
  const original = globalThis.XMLHttpRequest;
  const instances = [];
  globalThis.XMLHttpRequest = class {
    upload = {};
    constructor() { instances.push(this); }
    open() {}
    setRequestHeader() {}
    send() {}
  };
  t.after(() => {
    if (original === undefined) delete globalThis.XMLHttpRequest;
    else globalThis.XMLHttpRequest = original;
  });
  const progress = [];
  let completed = false;
  const pending = uploadMultipart('/admin/contents/upload-media', new FormData(), 'test-token', (value) => progress.push(value))
    .then((result) => { completed = true; return result; });
  const xhr = instances[0];
  assert.equal(xhr.timeout, 120_000);
  xhr.upload.onprogress({ lengthComputable: true, loaded: 50, total: 100 });
  xhr.upload.onprogress({ lengthComputable: true, loaded: 999, total: 1000 });
  xhr.upload.onprogress({ lengthComputable: true, loaded: 0, total: 0 });
  assert.deepEqual(progress, [50, 99]);
  xhr.upload.onload();
  await Promise.resolve();
  assert.deepEqual(progress, [50, 99, 100]);
  assert.equal(completed, false);
  xhr.status = 201;
  xhr.responseText = JSON.stringify({ url: 'https://media.test/bite.mp3' });
  xhr.onload();
  assert.deepEqual(await pending, { url: 'https://media.test/bite.mp3' });
  assert.equal(completed, true);
});

test('large Happy Bites audio keeps progress without the shared upload deadline', async (t) => {
  const original = globalThis.XMLHttpRequest;
  const instances = [];
  globalThis.XMLHttpRequest = class {
    upload = {};
    constructor() { instances.push(this); }
    open() {}
    setRequestHeader() {}
    send() {}
  };
  t.after(() => {
    if (original === undefined) delete globalThis.XMLHttpRequest;
    else globalThis.XMLHttpRequest = original;
  });
  const progress = [];
  const pending = uploadMultipart('/admin/contents/upload-happy-bite-audio', new FormData(), 'test-token', value => progress.push(value));
  const xhr = instances[0];
  assert.equal(xhr.timeout, 0);
  xhr.upload.onprogress({ lengthComputable: true, loaded: 75 * 1024 * 1024, total: 100 * 1024 * 1024 });
  assert.deepEqual(progress, [75]);
  xhr.status = 201;
  xhr.responseText = JSON.stringify({ url: 'https://media.test/large.mp3', durationSeconds: 900 });
  xhr.onload();
  assert.equal((await pending).durationSeconds, 900);
});
