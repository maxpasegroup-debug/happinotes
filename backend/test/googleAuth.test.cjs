const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { OAuth2Client } = require('google-auth-library');
const bcrypt = require('bcryptjs');
const identity = require('../dist/services/googleIdentity');
const { User } = require('../dist/models/User');
const { googleLogin } = require('../dist/controllers/authController');
const { requestDeletionReauth } = require('../dist/controllers/accountDeletionController');
const { AccountDeletionReauth } = require('../dist/models/AccountDeletionReauth');
const moderation = require('../dist/services/accountModeration');
const deletion = require('../dist/services/accountDeletion');
const vpn = require('../dist/services/vpnSecurity');
const sessions = require('../dist/services/accountSessions');
const previousAudience = process.env.GOOGLE_SIGN_IN_WEB_CLIENT_ID;
afterEach(() => { mock.restoreAll(); if (previousAudience === undefined) delete process.env.GOOGLE_SIGN_IN_WEB_CLIENT_ID; else process.env.GOOGLE_SIGN_IN_WEB_CLIENT_ID = previousAudience; });
const idToken = 'test.'.repeat(60);
const google = { subject: 'google-subject', email: 'person@example.test', name: 'Person', photoUrl: 'https://lh3.googleusercontent.com/avatar' };
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; } });
async function login(body = {}) {
  const res = response(); let error;
  await googleLogin({ body: { idToken, ...body }, ip: '192.0.2.1' }, res, e => { error = e; });
  return { res, error };
}
function setup(existing) {
  const writes = [], started = [], created = [];
  mock.method(identity, 'verifyGoogleIdentity', async () => google);
  mock.method(vpn, 'assertNoSecurityBlock', async () => {});
  mock.method(vpn, 'checkVpnLogin', async () => 'installation');
  mock.method(moderation, 'releaseExpiredBan', async () => {});
  mock.method(deletion, 'isAccountWritable', async () => true);
  mock.method(User, 'findOne', filter => ({ select: async () => existing && (filter.googleId ? existing.googleId === filter.googleId : existing.email === filter.email) ? existing : null }));
  mock.method(User, 'create', async data => { created.push(data); return { _id: 'account', purchasedBooks: [], ...data }; });
  mock.method(User, 'updateOne', async (...args) => { writes.push(args); return { matchedCount: 1 }; });
  mock.method(sessions, 'startAccountSession', async (user, installation) => { started.push({ user, installation }); return 'app-session'; });
  return { writes, started, created };
}
test('Google token verification pins the audience and rejects invalid, expired or unverified identity', async () => {
  process.env.GOOGLE_SIGN_IN_WEB_CLIENT_ID = 'web.apps.googleusercontent.com';
  let claims = { sub: 'subject', email: 'User@example.test', email_verified: true, name: 'User', exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000), picture: google.photoUrl };
  mock.method(OAuth2Client.prototype, 'verifyIdToken', async options => { assert.equal(options.audience, process.env.GOOGLE_SIGN_IN_WEB_CLIENT_ID); assert.equal(options.idToken, idToken); return { getPayload: () => claims }; });
  assert.equal((await identity.verifyGoogleIdentity(idToken)).email, 'user@example.test');
  claims = { ...claims, email_verified: false };
  await assert.rejects(identity.verifyGoogleIdentity(idToken), e => e.statusCode === 401);
  claims = { ...claims, email_verified: true, exp: 1 };
  await assert.rejects(identity.verifyGoogleIdentity(idToken), e => e.statusCode === 401);
  claims = { ...claims, exp: Math.floor(Date.now() / 1000) + 3600, iat: 1 };
  await assert.rejects(identity.verifyGoogleIdentity(idToken, true), e => e.statusCode === 401);
});
test('missing configuration fails closed and verifier failures hide provider diagnostics', async () => {
  delete process.env.GOOGLE_SIGN_IN_WEB_CLIENT_ID;
  await assert.rejects(identity.verifyGoogleIdentity(idToken), e => e.statusCode === 503);
  process.env.GOOGLE_SIGN_IN_WEB_CLIENT_ID = 'web.apps.googleusercontent.com';
  mock.method(OAuth2Client.prototype, 'verifyIdToken', async () => { throw Error('https://private.example/?token=secret'); });
  await assert.rejects(identity.verifyGoogleIdentity(idToken), e => e.statusCode === 401 && !e.message.includes('http') && !e.message.includes('secret'));
});
test('only Google HTTPS profile images are accepted', () => {
  assert.equal(identity.googlePhotoUrl(google.photoUrl), google.photoUrl);
  for (const value of ['http://lh3.googleusercontent.com/a', 'https://googleusercontent.com.evil.test/a', 'https://u:p@lh3.googleusercontent.com/a', 'https://lh3.googleusercontent.com:444/a', 'javascript:alert(1)', null]) assert.equal(identity.googlePhotoUrl(value), undefined);
});
test('new Google sign-up creates an ordinary account and uses the existing session machinery', async () => {
  const calls = setup(); const { res, error } = await login({ role: 'admin', email: 'forged@example.test' });
  assert.equal(error, undefined); assert.equal(res.statusCode, 201);
  assert.equal(calls.created[0].role, 'user'); assert.equal(calls.created[0].email, google.email);
  assert.equal(calls.created[0].password, undefined); assert.equal(calls.started.length, 1);
  assert.equal(calls.started[0].installation, 'installation');
  assert.equal(res.body.user.profileImageUrl, google.photoUrl); assert.equal(res.body.user.googleId, undefined);
  assert.equal(res.body.token, 'app-session');
  const document = new User(calls.created[0]); assert.equal(document.validateSync(), undefined);
  assert.ok(new User({ name: 'Email user', email: 'email@example.test' }).validateSync().errors.password);
});
test('returning Google login preserves the account, purchases and subscription', async () => {
  const existing = { _id: 'original', email: google.email, googleId: google.subject, googleLinked: true, name: 'Existing', role: 'user', purchasedBooks: ['book'], subscription: { active: true, planKey: 'yearly' } };
  const calls = setup(existing); const { res, error } = await login();
  assert.equal(error, undefined); assert.equal(calls.created.length, 0); assert.equal(res.body.user.id, 'original');
  assert.deepEqual(res.body.user.purchasedBookIds, ['book']); assert.equal(res.body.user.subscriptionActive, true);
  assert.equal(calls.started.length, 1); assert.equal(calls.writes[0][1].$set.profileImageUrl, google.photoUrl);
});
test('matching email cannot link without the existing password, then links atomically', async () => {
  const existing = { _id: 'original', email: google.email, role: 'user', password: 'hash', purchasedBooks: ['book'] };
  const calls = setup(existing);
  assert.equal((await login()).error.statusCode, 409); assert.equal(calls.started.length, 0);
  mock.method(bcrypt, 'compare', async password => password === 'correct');
  assert.equal((await login({ password: 'wrong' })).error.statusCode, 401);
  mock.method(User, 'findOneAndUpdate', (filter, update) => {
    assert.equal(filter.password, 'hash'); assert.deepEqual(filter.googleId, { $exists: false });
    assert.equal(filter.blocked.$ne, true);
    return { select: async () => ({ ...existing, ...update.$set }) };
  });
  const { res, error } = await login({ password: 'correct' });
  assert.equal(error, undefined); assert.equal(res.body.user.googleLinked, true);
  assert.equal(res.body.user.id, 'original'); assert.deepEqual(res.body.user.purchasedBookIds, ['book']);
});
test('banned, administrator, VPN-rejected and deletion-pending accounts receive no session', async () => {
  for (const variation of [{ blocked: true }, { role: 'admin' }, { pending: true }, { vpn: true }]) {
    mock.restoreAll();
    const calls = setup({ _id: 'account', role: 'user', email: google.email, googleId: google.subject, ...variation });
    if (variation.pending) mock.method(deletion, 'isAccountWritable', async () => false);
    if (variation.vpn) mock.method(vpn, 'checkVpnLogin', async () => { throw Error('VPN detected'); });
    const { error } = await login(); assert.ok(error); assert.equal(calls.started.length, 0);
  }
});
test('Google deletion reauthentication requires a fresh token for the same subject', async () => {
  mock.method(User, 'findById', () => ({ select: async () => ({ googleId: google.subject }) }));
  mock.method(deletion, 'isAccountWritable', async () => true);
  let subject = 'other', proofs = 0;
  mock.method(identity, 'verifyGoogleIdentity', async (_, recent) => { assert.equal(recent, true); return { ...google, subject }; });
  mock.method(deletion, 'confirmRelatedRecordOwner', async () => true);
  mock.method(AccountDeletionReauth, 'create', async () => { proofs++; });
  const req = { user: { _id: 'account' }, body: { googleIdToken: idToken } };
  let error; await requestDeletionReauth(req, response(), e => { error = e; });
  assert.equal(error.statusCode, 401); assert.equal(proofs, 0);
  subject = google.subject; const res = response(); error = undefined;
  await requestDeletionReauth(req, res, e => { error = e; });
  assert.equal(error, undefined); assert.equal(proofs, 1); assert.ok(res.body.proof.length > 20);
});
test('Firebase browser sign-in reuses the same Google-linked account and existing session policy', async () => {
  const firebaseIdentity = require('../dist/services/firebaseGoogleIdentity');
  const calls = setup({ _id: 'original', googleId: google.subject, googleLinked: true, email: google.email, name: 'Person', role: 'user', purchasedBooks: ['book'] });
  mock.method(firebaseIdentity, 'verifyFirebaseGoogleIdentity', async token => { assert.equal(token, idToken); return google; });
  const { res, error } = await login({ idToken: undefined, firebaseIdToken: idToken });
  assert.equal(error, undefined); assert.equal(res.body.user.id, 'original'); assert.equal(calls.created.length, 0); assert.equal(calls.started.length, 1);
  assert.deepEqual(res.body.user.purchasedBookIds, ['book']);
});
test('Firebase deletion reauthentication requires recent Google sign-in for the same linked subject', async () => {
  const firebaseIdentity = require('../dist/services/firebaseGoogleIdentity');
  mock.method(User, 'findById', () => ({ select: async () => ({ googleId: google.subject }) }));
  mock.method(deletion, 'isAccountWritable', async () => true);
  let subject = 'other', proofs = 0;
  mock.method(firebaseIdentity, 'verifyFirebaseGoogleIdentity', async (_, recent) => { assert.equal(recent, true); return { ...google, subject }; });
  mock.method(deletion, 'confirmRelatedRecordOwner', async () => true);
  mock.method(AccountDeletionReauth, 'create', async () => { proofs++; });
  const req = { user: { _id: 'account' }, body: { firebaseIdToken: idToken } }; let error;
  await requestDeletionReauth(req, response(), e => { error = e; }); assert.equal(error.statusCode, 401); assert.equal(proofs, 0);
  subject = google.subject; error = undefined; await requestDeletionReauth(req, response(), e => { error = e; });
  assert.equal(error, undefined); assert.equal(proofs, 1);
});
