const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const admin = require('../dist/services/firebaseAdmin');
const identity = require('../dist/services/firebaseGoogleIdentity');
const service = require('../dist/services/googleBrowserSession');
const { GoogleBrowserSession: Model } = require('../dist/models/GoogleBrowserSession');
const { googleBrowserPage } = require('../dist/services/googleBrowserPage');
const saved = { config: process.env.FIREBASE_WEB_CONFIG_JSON, origin: process.env.GOOGLE_SIGN_IN_BROWSER_ORIGIN };
afterEach(() => { mock.restoreAll(); for (const [key, value] of [['FIREBASE_WEB_CONFIG_JSON', saved.config], ['GOOGLE_SIGN_IN_BROWSER_ORIGIN', saved.origin]]) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
function setup() {
  const firebase = { apiKey: 'public-key', projectId: 'happi-test', authDomain: 'happi-test.firebaseapp.com', appId: 'web-app-id' };
  process.env.FIREBASE_WEB_CONFIG_JSON = JSON.stringify(firebase); process.env.GOOGLE_SIGN_IN_BROWSER_ORIGIN = 'https://happi.example';
  mock.method(admin, 'getFirebaseAuth', () => ({ app: { options: { projectId: 'happi-test' } } }));
  return firebase;
}
function store() {
  let document;
  const matches = f => document && Object.entries(f).every(([k, v]) => k === 'expiresAt' ? document.expiresAt > v.$gt : v?.$in ? v.$in.includes(document[k]) : document[k] === v);
  mock.method(Model, 'create', async data => { document = { ...data }; return document; });
  mock.method(Model, 'exists', async f => !!matches(f));
  mock.method(Model, 'findOneAndUpdate', async (f, u) => { if (!matches(f)) return null; const previous = { ...document }; Object.assign(document, u.$set); return previous; });
  mock.method(Model, 'updateOne', async (f, u) => { if (!matches(f)) return { modifiedCount: 0 }; Object.assign(document, u.$set); return { modifiedCount: 1 }; });
  mock.method(Model, 'findOneAndDelete', f => ({ select: async () => { if (!matches(f)) return null; const result = document; document = undefined; return result; } }));
  return { get document() { return document; } };
}
test('Firebase verification requires verified Google identity and checks revocation', async () => {
  let claims = { uid: 'firebase-uid', email: 'User@example.test', email_verified: true, exp: Date.now()/1000+3600, auth_time: Date.now()/1000, firebase: { sign_in_provider: 'google.com', identities: { 'google.com': ['google-subject'] } } };
  mock.method(admin, 'getFirebaseAuth', () => ({ verifyIdToken: async (token, revoked) => { assert.equal(revoked, true); return claims; } }));
  const verified = await identity.verifyFirebaseGoogleIdentity('x'.repeat(100), true);
  assert.equal(verified.subject, 'google-subject'); assert.equal(verified.email, 'user@example.test');
  for (const change of [{ email_verified: false }, { firebase: { sign_in_provider: 'password' } }, { exp: 1 }, { auth_time: 1 }]) {
    const previous = claims; claims = { ...claims, ...change }; await assert.rejects(identity.verifyFirebaseGoogleIdentity('x'.repeat(100), true), e => e.statusCode === 401); claims = previous;
  }
});
test('Firebase provider failures never return token or URL diagnostics', async () => {
  mock.method(admin, 'getFirebaseAuth', () => ({ verifyIdToken: async () => { throw Error('https://private.example?token=secret'); } }));
  await assert.rejects(identity.verifyFirebaseGoogleIdentity('x'.repeat(100)), e => !/http|secret/.test(e.message));
});
test('browser config fails closed on project mismatch and non-HTTPS origins', () => {
  setup(); assert.equal(service.browserConfiguration().origin, 'https://happi.example');
  process.env.GOOGLE_SIGN_IN_BROWSER_ORIGIN = 'http://happi.example'; assert.throws(service.browserConfiguration);
  process.env.GOOGLE_SIGN_IN_BROWSER_ORIGIN = 'https://happi.example';
  process.env.FIREBASE_WEB_CONFIG_JSON = JSON.stringify({ apiKey: 'key', projectId: 'other', authDomain: 'happi.firebaseapp.com', appId: 'app' }); assert.throws(service.browserConfiguration);
});
test('handoff is cookie-bound, verifier-bound, encrypted, expiring and consumed only once', async () => {
  setup(); const db = store(); const verifier = 'a'.repeat(64);
  const { sessionId } = await service.startBrowserSession(service.digest(verifier));
  assert.notEqual(db.document.sessionHash, sessionId); assert.ok(db.document.expiresAt - Date.now() <= 300000);
  const { cookie } = await service.openBrowserSession(sessionId);
  await assert.rejects(service.openBrowserSession(sessionId, 'b'.repeat(64)));
  assert.equal((await service.openBrowserSession(sessionId, cookie)).cookie, cookie);
  mock.method(identity, 'verifyFirebaseGoogleIdentity', async () => ({}));
  const token = 'private-firebase-token';
  await assert.rejects(service.completeBrowserSession(sessionId, 'b'.repeat(64), token));
  await service.completeBrowserSession(sessionId, cookie, token);
  assert.ok(!db.document.sealedToken.includes(token));
  await assert.rejects(service.pollBrowserSession(sessionId, 'b'.repeat(64)));
  assert.equal((await service.pollBrowserSession(sessionId, verifier)).firebaseIdToken, token);
  await assert.rejects(service.pollBrowserSession(sessionId, verifier));
});
test('expired and cancelled handoffs cannot produce an identity', async () => {
  setup(); const db = store(), verifier = 'c'.repeat(64);
  let { sessionId } = await service.startBrowserSession(service.digest(verifier));
  assert.equal((await service.pollBrowserSession(sessionId, verifier)).status, 'pending');
  assert.equal((await service.pollBrowserSession(sessionId, verifier, true)).status, 'cancelled');
  await assert.rejects(service.pollBrowserSession(sessionId, verifier));
  ({ sessionId } = await service.startBrowserSession(service.digest(verifier)));
  db.document.expiresAt = new Date(0); await assert.rejects(service.openBrowserSession(sessionId));
  await assert.rejects(service.pollBrowserSession(sessionId, verifier));
});
test('authenticated encryption rejects tampering and cross-session token reuse', () => {
  const packed = service.sealToken('token', 'session-a');
  assert.equal(service.unsealToken(packed, 'session-a'), 'token');
  assert.throws(() => service.unsealToken(packed, 'session-b'));
  const data = Buffer.from(packed, 'base64url'); data[15] ^= 1;
  assert.throws(() => service.unsealToken(data.toString('base64url'), 'session-a'));
});
test('browser page escapes configuration and uses Firebase in-memory persistence', () => {
  const html = googleBrowserPage('a'.repeat(64), { apiKey: '</script><script>bad</script>' }, 'nonce');
  assert.ok(!html.includes('</script><script>bad')); assert.ok(html.includes('sdk.inMemoryPersistence'));
  assert.ok(html.includes('signInWithPopup')); assert.ok(html.includes('Return to HappiNotes'));
  assert.ok(Model.schema.indexes().some(([index, options]) => index.expiresAt && options.expireAfterSeconds === 0));
});
test('HTTP handoff routes require browser origin and expose restrictive, non-cached pages', async () => {
  setup(); store();
  const express = require('express');
  const router = require('../dist/routes/googleBrowserRoutes').default;
  const app = express(); app.use(express.json()); app.use('/auth/google/browser', router);
  app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({ message: 'failed' }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}/auth/google/browser`;
  try {
    const start = await fetch(base+'/start', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({challenge:service.digest('d'.repeat(64))}) });
    const {sessionId} = await start.json(); assert.equal(start.headers.get('cache-control'), 'no-store');
    const page = await fetch(base+'/page?session='+sessionId); assert.equal(page.status, 200);
    assert.ok(page.headers.get('set-cookie').includes('HttpOnly')); assert.ok(page.headers.get('set-cookie').includes('Secure'));
    assert.ok(page.headers.get('content-security-policy').includes("frame-ancestors 'none'"));
    assert.equal(page.headers.get('cross-origin-opener-policy'), 'same-origin-allow-popups');
    const bad = await fetch(base+'/complete', { method:'POST', headers:{'Content-Type':'application/json', Origin:'https://attacker.example'}, body:JSON.stringify({sessionId,firebaseIdToken:'x'.repeat(100)}) });
    assert.equal(bad.status, 403);
  } finally { await new Promise(r => server.close(r)); }
});

test('Firebase browser can complete through global production CORS middleware', async () => {
  setup(); store();
  const express = require('express'), cors = require('cors');
  const { buildCorsConfiguration } = require('../dist/config/cors');
  const router = require('../dist/routes/googleBrowserRoutes').default;
  const app = express();
  app.use(cors(buildCorsConfiguration('production', 'https://happinotes.online', 'https://happi.example').httpOptions));
  app.use(express.json()); app.use('/auth/google/browser', router);
  app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({ message: 'failed' }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}/auth/google/browser`;
  const verifier = 'e'.repeat(64);
  try {
    const start = await fetch(base+'/start', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({challenge:service.digest(verifier)}) });
    const {sessionId} = await start.json();
    const page = await fetch(base+'/page?session='+sessionId);
    const cookie = page.headers.get('set-cookie').split(';')[0];
    mock.method(identity, 'verifyFirebaseGoogleIdentity', async () => ({subject:'verified-google'}));
    const completed = await fetch(base+'/complete', { method:'POST', headers:{'Content-Type':'application/json',Origin:'https://happi.example',Cookie:cookie}, body:JSON.stringify({sessionId,firebaseIdToken:'firebase-token'}) });
    assert.equal(completed.status,200); assert.equal(completed.headers.get('access-control-allow-origin'),'https://happi.example');
    const poll = await service.pollBrowserSession(sessionId,verifier); assert.equal(poll.firebaseIdToken,'firebase-token');
    const attacker = await fetch(base+'/complete', { method:'POST', headers:{'Content-Type':'application/json',Origin:'https://attacker.example'}, body:'{}' });
    assert.notEqual(attacker.status,200);
  } finally { await new Promise(r => server.close(r)); }
});
