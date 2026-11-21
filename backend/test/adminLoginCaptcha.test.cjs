const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const { AdminLoginCaptcha, captchaOwner, issueAdminCaptcha, consumeAdminCaptcha } = require('../dist/services/adminLoginCaptcha');
const { User } = require('../dist/models/User');
const deletion = require('../dist/services/accountDeletion');
const sessions = require('../dist/services/accountSessions');
const router = require('../dist/routes/authRoutes').default;

function stubChallengeStore(t) {
  const rows = new Map();
  t.mock.method(AdminLoginCaptcha, 'updateOne', async ({ _id }, { $set }) => rows.set(_id, $set));
  t.mock.method(AdminLoginCaptcha, 'findOneAndDelete', ({ _id, nonce, expiresAt }) => ({
    lean: async () => {
      const row = rows.get(_id);
      if (!row || row.nonce !== nonce || row.expiresAt <= expiresAt.$gt) return null;
      rows.delete(_id);
      return row;
    },
  }));
  return rows;
}

test('refresh, expiration, owner binding and concurrent use of a CAPTCHA', async (t) => {
  const rows = stubChallengeStore(t);
  let digit = 12340;
  t.mock.method(crypto, 'randomInt', () => ++digit);
  const owner = captchaOwner('Admin@example.org', '192.0.2.8');
  assert.equal(owner, captchaOwner(' admin@example.org ', '192.0.2.8'));
  const old = await issueAdminCaptcha(owner);
  const fresh = await issueAdminCaptcha(owner);
  assert.notEqual(fresh.id, old.id);
  assert.deepEqual(Object.keys(fresh).sort(), ['id', 'image']);
  const svg = Buffer.from(fresh.image.split(',')[1], 'base64').toString();
  assert.match(svg, /<path /);
  assert.doesNotMatch(svg, /<text|012342/);
  assert.equal(await consumeAdminCaptcha(owner, old.id, '012341'), false);
  assert.equal(await consumeAdminCaptcha(captchaOwner('different@example.org', '192.0.2.8'), fresh.id, '012342'), false);
  assert.equal(await consumeAdminCaptcha(captchaOwner('admin@example.org', '192.0.2.9'), fresh.id, '012342'), false);
  assert.deepEqual(await Promise.all([consumeAdminCaptcha(owner, fresh.id, '012342'), consumeAdminCaptcha(owner, fresh.id, '012342')]), [true, false]);
  const expired = await issueAdminCaptcha(owner);
  assert.ok(Math.abs(rows.get(owner).expiresAt - Date.now() - 300000) < 1000);
  rows.get(owner).expiresAt = new Date(Date.now() - 1);
  assert.equal(await consumeAdminCaptcha(owner, expired.id, '012343'), false);
});

test('admin can sign in after throttling with one valid code and valid credentials', async (t) => {
  stubChallengeStore(t);
  t.mock.method(crypto, 'randomInt', () => 1234);
  const email = 'admin@example.org';
  const password = 'test-password';
  const user = { _id: 'admin-id', email, role: 'admin', password: await bcrypt.hash(password, 4) };
  t.mock.method(User, 'findOne', (query) => ({
    select: async () => (query.role === 'admin' && query.email === email ? user : null),
  }));
  t.mock.method(deletion, 'isAccountWritable', async () => true);
  const signIn = t.mock.method(sessions, 'startAccountSession', async () => 'test-session');
  const app = express().use(express.json()).use('/auth', router);
  app.use((err, req, res, next) => res.status(err.statusCode || 500).json({ message: err.message }));
  const server = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const post = (path, body) => fetch('http://127.0.0.1:' + server.address().port + '/auth/' + path, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  async function requestCode(forEmail = email) {
    const result = await post('admin/captcha', { email: forEmail });
    assert.equal(result.status, 200);
    assert.equal(result.headers.get('cache-control'), 'no-store');
    return (await result.json()).id;
  }
  const retry = (challengeId, overrides) => post('admin/captcha-login', { email, password, challengeId, code: '001234', ...overrides });
  for (let i = 0; i < 5; i++) assert.equal((await post('login', { email, password: 'incorrect' })).status, 401);
  assert.equal((await post('login', { email, password })).status, 429);
  const first = await requestCode();
  assert.equal((await retry(first, { code: '111111' })).status, 422);
  assert.equal((await retry(first)).status, 422);
  assert.equal((await retry(await requestCode(), { password: 'incorrect' })).status, 401);
  const otherEmail = 'reader@example.org';
  assert.equal((await retry(await requestCode(otherEmail), { email: otherEmail })).status, 401);
  assert.equal(signIn.mock.callCount(), 0);
  const correct = await retry(await requestCode());
  assert.equal(correct.status, 200);
  assert.equal((await correct.json()).token, 'test-session');
  assert.equal(signIn.mock.callCount(), 1);
  for (let i = 0; i < 5; i++) assert.equal((await retry(first)).status, 422);
  const limited = await retry(await requestCode());
  assert.equal(limited.status, 429);
  assert.ok(limited.headers.get('retry-after'));
});
