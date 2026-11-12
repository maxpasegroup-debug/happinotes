import { test, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { forwardDevelopmentApi } from '../lib/dev-api-proxy.ts';
import { apiRequest } from '../lib/api.ts';

const originalEnv = process.env.NODE_ENV;
afterEach(() => {
  mock.restoreAll();
  delete globalThis.window;
  if (originalEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalEnv;
});

const request = (path, init) => new Request(`http://localhost:3001/api/backend/${path}`, init);

test('local login passes the body to the configured API without localhost CORS headers', async () => {
  const body = JSON.stringify({ email: 'admin@example.test', password: 'test-only' });
  const response = await forwardDevelopmentApi(request('auth/login', {
    method: 'POST', body,
    headers: { 'content-type': 'application/json', origin: 'http://localhost:3001', cookie: 'ignore=true' },
  }), ['auth', 'login'], 'https://api.example.test/', 'development', async (url, init) => {
    assert.equal(String(url), 'https://api.example.test/auth/login');
    assert.equal(init.headers.get('origin'), null);
    assert.equal(init.headers.get('cookie'), null);
    assert.equal(await new Response(init.body).text(), body);
    assert.equal(init.headers.get('content-type'), 'application/json');
    return Response.json({ token: 'test-token', user: { role: 'admin' } });
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).token, 'test-token');
});

test('admin authorization, query parameters, and upstream auth errors are preserved', async () => {
  const response = await forwardDevelopmentApi(request('admin/happy-bites?page=2', {
    headers: { authorization: 'Bearer test-token' },
  }), ['admin', 'happy-bites'], 'http://localhost:3000', 'development', async (url, init) => {
    assert.equal(String(url), 'http://localhost:3000/admin/happy-bites?page=2');
    assert.equal(init.headers.get('authorization'), 'Bearer test-token');
    return Response.json({ message: 'Invalid or expired token' }, { status: 401 });
  });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).message, 'Invalid or expired token');
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('multipart upload body and boundary are forwarded without JSON conversion', async () => {
  const body = new FormData();
  body.append('scope', 'happy-bite-thumbnail');
  body.append('media', new Blob(['image-bytes'], { type: 'image/png' }), 'test.png');
  const response = await forwardDevelopmentApi(request('admin/contents/upload-media', {
    method: 'POST', body,
  }), ['admin', 'contents', 'upload-media'], 'http://localhost:3000', 'development', async (url, init) => {
    const forwarded = new Request(url, init);
    const data = await forwarded.formData();
    assert.equal(data.get('scope'), 'happy-bite-thumbnail');
    assert.equal(await data.get('media').text(), 'image-bytes');
    return Response.json({ url: 'https://media.example.test/image.png' });
  });
  assert.equal(response.status, 200);
});

test('development proxy is unavailable in production and rejects traversal', async () => {
  const fetcher = () => { throw new Error('Must not reach upstream'); };
  const production = await forwardDevelopmentApi(request('auth/login'), ['auth', 'login'], 'https://api.example.test', 'production', fetcher);
  assert.equal(production.status, 404);
  for (const path of [[], ['..', 'auth'], ['admin/../auth'], ['\\auth']]) {
    assert.equal((await forwardDevelopmentApi(request('auth'), path, 'https://api.example.test', 'development', fetcher)).status, 400);
  }
});

test('unreachable backend produces an actionable error without leaking internal errors', async () => {
  const response = await forwardDevelopmentApi(request('auth/login'), ['auth', 'login'], 'https://api.example.test', 'development', async () => {
    throw new Error('internal-secret');
  });
  assert.equal(response.status, 502);
  const data = await response.json();
  assert.match(data.message, /NEXT_PUBLIC_API_BASE_URL/);
  assert.doesNotMatch(data.message, /internal-secret/);
});

test('browser API client uses local proxy in development and direct URL in production', async () => {
  globalThis.window = {};
  const urls = [];
  mock.method(globalThis, 'fetch', async (url) => {
    urls.push(url);
    return Response.json({ success: true });
  });
  process.env.NODE_ENV = 'development';
  await apiRequest('/auth/login', 'POST', { email: 'admin@example.test', password: 'test-only' });
  assert.equal(urls[0], '/api/backend/auth/login');
  process.env.NODE_ENV = 'production';
  await apiRequest('/admin/contents');
  assert.match(urls[1], /^https?:\/\/.+\/admin\/contents$/);
});
