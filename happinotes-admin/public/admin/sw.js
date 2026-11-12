/* Only public offline assets are cached. Admin pages, APIs, uploads and tokens
   always go to the network and never enter the service-worker cache. */
const CACHE_PREFIX = 'happinotes-admin-offline-';
const CACHE_NAME = `${CACHE_PREFIX}v1`;
const OFFLINE_URL = '/admin/offline.html';
const OFFLINE_ASSETS = [
  OFFLINE_URL,
  '/admin/icons/icon-192.png',
  '/admin/icons/icon-512.png',
  '/admin/icons/icon-maskable-512.png',
  '/admin/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(OFFLINE_ASSETS);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate' && url.pathname.startsWith('/admin/')) {
    event.respondWith(fetch(request).catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      return (await cache.match(OFFLINE_URL)) || new Response('You are offline. Reconnect and reload HappiNotes Admin.', {
        status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }));
    return;
  }

  if (OFFLINE_ASSETS.includes(url.pathname) && !url.search) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      return (await cache.match(url.pathname)) || fetch(request);
    })());
  }
});
