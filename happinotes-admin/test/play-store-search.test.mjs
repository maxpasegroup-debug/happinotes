import test from 'node:test';
import assert from 'node:assert/strict';
import { searchPlayStore } from '../lib/play-store-search.ts';

const base = 'https://internal.invalid';
const listing = 'https://play.google.com/store/apps/details?id=com.example.reader';
const request = (q, authorized = true) => new Request('https://admin.invalid/api/admin/play-search?' + new URLSearchParams({ q }), {
  headers: authorized ? { Authorization: 'Bearer test' } : {},
});

test('exact listing lookup restricts results to that package and authorizes cached reads', async () => {
  let lookups = 0;
  const fetcher = async (url, init) => {
    if (url.startsWith(base)) return Response.json({ configured: true });
    assert.equal(init.headers.Authorization, undefined);
    assert.equal(JSON.parse(init.body).q, 'site:play.google.com/store/apps/details com.example.reader');
    lookups++;
    return Response.json({ organic: [
      { title: 'Reader', link: listing + '&hl=en', snippet: 'Books' },
      { title: 'Duplicate', link: listing },
      { title: 'Other', link: listing + '2' },
      { title: 'External', link: 'https://example.org/' },
    ] });
  };
  for (let i = 0; i < 2; i++) {
    const response = await searchPlayStore(request(listing), base, 'test-key', fetcher);
    assert.deepEqual((await response.json()).items, [{ title: 'Reader', summary: 'Books', url: listing, packageName: 'com.example.reader' }]);
  }
  assert.equal(lookups, 1);
  const denied = await searchPlayStore(request(listing), base, 'test-key', async () => new Response(null, { status: 403 }));
  assert.equal(denied.status, 403);
});

test('invalid searches, missing sessions and provider outages return safe messages', async () => {
  const fail = () => { throw new Error('Unexpected fetch'); };
  assert.equal((await searchPlayStore(request('books', false), base, '', fail)).status, 401);
  assert.equal((await searchPlayStore(request('https://example.org/'), base, '', fail)).status, 400);
  const response = await searchPlayStore(request('reader apps'), base, 'test-key', async url =>
    url.startsWith(base) ? Response.json({ configured: true }) : new Response('SECRET_KEY=private', { status: 429 }));
  assert.equal(response.status, 429);
  assert.doesNotMatch(await response.text(), /private|SECRET_KEY/);
});
