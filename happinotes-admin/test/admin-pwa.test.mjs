import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const publicRoot = new URL('../public/', import.meta.url);
const workerSource = readFileSync(new URL('admin/sw.js', publicRoot), 'utf8');
const origin = 'https://admin.example.test';

function worker() {
  const handlers = {};
  const stores = new Map();
  const network = [];
  let offline = false;
  let status = 200;
  let claimed = false;
  let skipped = false;
  const context = {
    URL, Response,
    self: {
      location: { origin },
      addEventListener: (type, listener) => { handlers[type] = listener; },
      skipWaiting: async () => { skipped = true; },
      clients: { claim: async () => { claimed = true; } },
    },
    caches: {
      keys: async () => [...stores.keys()],
      delete: async (key) => stores.delete(key),
      open: async (name) => {
        if (!stores.has(name)) stores.set(name, new Map());
        const entries = stores.get(name);
        return {
          addAll: async (urls) => { for (const url of urls) entries.set(url, new Response(`Static ${url}`)); },
          match: async (url) => entries.get(url)?.clone(),
        };
      },
    },
    fetch: async (request) => {
      network.push(request);
      if (offline) throw new TypeError('Network unavailable');
      return new Response('Live authenticated response', { status });
    },
  };
  runInNewContext(workerSource, context);
  const lifecycle = async (type) => {
    let work;
    handlers[type]({ waitUntil: (promise) => { work = promise; } });
    await work;
  };
  const fetchEvent = (path, { method = 'GET', mode = 'navigate' } = {}) => {
    let response;
    handlers.fetch({ request: { url: new URL(path, origin).href, method, mode }, respondWith: (promise) => { response = promise; } });
    return response;
  };
  return { stores, network, lifecycle, fetchEvent, offline: () => { offline = true; }, status: (value) => { status = value; }, claimed: () => claimed, skipped: () => skipped };
}

test('manifest stays within admin and provides correctly sized install icons', () => {
  const manifest = JSON.parse(readFileSync(new URL('admin/manifest.webmanifest', publicRoot), 'utf8'));
  assert.equal(manifest.scope, '/admin/');
  assert.equal(manifest.id, '/admin/');
  assert.ok(manifest.start_url.startsWith(manifest.scope));
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.icons.some((icon) => icon.sizes === '192x192'));
  assert.ok(manifest.icons.some((icon) => icon.sizes === '512x512' && icon.purpose === 'maskable'));
  for (const icon of manifest.icons) {
    const data = readFileSync(new URL(icon.src.slice(1), publicRoot));
    assert.equal(data.subarray(1, 4).toString(), 'PNG');
    assert.equal(`${data.readUInt32BE(16)}x${data.readUInt32BE(20)}`, icon.sizes);
  }
  for (const shortcut of manifest.shortcuts) assert.ok(shortcut.url.startsWith(manifest.scope));
});

test('installation caches public fallback assets only and activation leaves other apps alone', async () => {
  const sw = worker();
  sw.stores.set('happinotes-admin-offline-old', new Map());
  sw.stores.set('reader-cache', new Map());
  await sw.lifecycle('install');
  const cache = sw.stores.get('happinotes-admin-offline-v1');
  assert.ok(cache.has('/admin/offline.html'));
  for (const url of cache.keys()) {
    assert.ok(url === '/admin/offline.html' || url.startsWith('/admin/icons/'));
    assert.ok(readFileSync(new URL(url.slice(1), publicRoot)).length > 0);
  }
  assert.equal(sw.skipped(), true);
  await sw.lifecycle('activate');
  assert.equal(sw.stores.has('happinotes-admin-offline-old'), false);
  assert.equal(sw.stores.has('reader-cache'), true);
  assert.equal(sw.claimed(), true);
});

test('admin navigation uses the live network without caching private responses', async () => {
  const sw = worker();
  await sw.lifecycle('install');
  assert.equal(await (await sw.fetchEvent('/admin/dashboard')).text(), 'Live authenticated response');
  for (const cache of sw.stores.values()) assert.equal(cache.has('/admin/dashboard'), false);
  sw.status(401);
  assert.equal((await sw.fetchEvent('/admin/happy-bites')).status, 401);
});

test('offline admin navigation gets the fallback and static icons remain available', async () => {
  const sw = worker();
  await sw.lifecycle('install');
  sw.offline();
  assert.match(await (await sw.fetchEvent('/admin/happy-bites')).text(), /offline\.html/);
  assert.match(await (await sw.fetchEvent('/admin/icons/icon-192.png', { mode: 'no-cors' })).text(), /icon-192\.png/);
  const empty = worker();
  empty.offline();
  assert.equal((await empty.fetchEvent('/admin/login')).status, 503);
});

test('API calls, uploads, Next.js navigation data, external URLs and public pages are not intercepted', () => {
  const sw = worker();
  assert.equal(sw.fetchEvent('/api/backend/admin/happy-bites', { mode: 'cors' }), undefined);
  assert.equal(sw.fetchEvent('/admin/happy-bites', { method: 'POST', mode: 'cors' }), undefined);
  assert.equal(sw.fetchEvent('/admin/happy-bites?_rsc=example', { mode: 'cors' }), undefined);
  assert.equal(sw.fetchEvent('https://api.example.test/admin/happy-bites', { mode: 'cors' }), undefined);
  assert.equal(sw.fetchEvent('/lifebooks'), undefined);
});
