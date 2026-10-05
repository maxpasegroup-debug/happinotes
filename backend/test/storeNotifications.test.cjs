const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { OAuth2Client } = require('google-auth-library');
const { Type } = require('@apple/app-store-server-library');
const service = require('../dist/services/storePurchase');
const { StorePurchase } = require('../dist/models/StorePurchase');
const { User } = require('../dist/models');
const router = require('../dist/routes/storeNotificationRoutes').default;

afterEach(() => mock.restoreAll());
const claim = { _id: 'claim', userId: 'user', bookId: 'book', productId: 'book.product' };

async function dispatch(path, req) {
  const handler = router.stack.find((layer) => layer.route?.path === path).route.stack[0].handle;
  let status, error;
  await handler(req, { sendStatus: (value) => { status = value; } }, (value) => { error = value; });
  return { status, error };
}

function ledger(otherPurchase = false) {
  const changes = [], users = [];
  mock.method(StorePurchase, 'findOne', async () => claim);
  mock.method(StorePurchase, 'updateOne', async (_, update) => { changes.push(update); });
  mock.method(StorePurchase, 'exists', async () => otherPurchase);
  mock.method(User, 'updateOne', async (_, update) => { users.push(update); });
  return { changes, users };
}

function googleIdentity(email = 'push@example.com') {
  process.env.IAP_GOOGLE_NOTIFICATION_AUDIENCE = 'https://api.example.com/payments/notifications/google';
  process.env.IAP_GOOGLE_NOTIFICATION_EMAIL = 'push@example.com';
  process.env.GOOGLE_PLAY_PACKAGE_NAME = 'com.happinotes.test';
  mock.method(OAuth2Client.prototype, 'verifyIdToken', async () => ({
    getPayload: () => ({ email, email_verified: true }),
  }));
  return { headers: { authorization: 'Bearer signed-token' }, body: { message: {
    data: Buffer.from(JSON.stringify({ packageName: 'com.happinotes.test',
      voidedPurchaseNotification: { purchaseToken: 'token' } })).toString('base64'),
  } } };
}

test('Google rejects a push from an unexpected identity without modifying ownership', async () => {
  const req = googleIdentity('attacker@example.com');
  const state = ledger();
  const result = await dispatch('/google', req);
  assert.equal(result.error.statusCode, 401);
  assert.equal(state.changes.length, 0);
});

test('Google refund removes access when no other purchase is active', async () => {
  const req = googleIdentity();
  const state = ledger();
  mock.method(service, 'googlePurchase', async () => ({ purchase: { purchaseState: 1 } }));
  const result = await dispatch('/google', req);
  assert.equal(result.status, 204);
  assert.deepEqual(state.changes[0], { $set: { active: false } });
  assert.deepEqual(state.users[0], { $pull: { purchasedBooks: 'book' } });
});

test('a refund preserves access granted by another active store purchase', async () => {
  const req = googleIdentity();
  const state = ledger(true);
  mock.method(service, 'googlePurchase', async () => ({ purchase: { purchaseState: 1 } }));
  await dispatch('/google', req);
  assert.equal(state.users.length, 0);
});

test('a delayed Google cancellation uses current purchased state and preserves access', async () => {
  const req = googleIdentity();
  const state = ledger();
  mock.method(service, 'googlePurchase', async () => ({ purchase: {
    purchaseState: 0, consumptionState: 0, obfuscatedExternalAccountId: service.accountToken('user'),
  } }));
  await dispatch('/google', req);
  assert.deepEqual(state.changes[0], { $set: { active: true } });
  assert.deepEqual(state.users[0], { $addToSet: { purchasedBooks: 'book' } });
});

test('provider outage leaves ownership untouched and returns a retryable error', async () => {
  const req = googleIdentity();
  const state = ledger();
  mock.method(service, 'googlePurchase', async () => { throw new Error('provider outage'); });
  const result = await dispatch('/google', req);
  assert.equal(result.error.statusCode, 503);
  assert.equal(state.changes.length, 0);
});

test('Apple refund uses current signed transaction state before removing access', async () => {
  const state = ledger();
  mock.method(service, 'applePurchaseClient', () => ({
    environment: 'Sandbox',
    client: { getTransactionInfo: async () => ({ signedTransactionInfo: 'current' }) },
    verifier: {
      verifyAndDecodeNotification: async () => ({ data: { signedTransactionInfo: 'old' } }),
      verifyAndDecodeTransaction: async (value) => ({
        transactionId: 'transaction', originalTransactionId: 'original', type: Type.NON_CONSUMABLE,
        productId: claim.productId, appAccountToken: service.accountToken('user'),
        ...(value === 'current' ? { revocationDate: 1 } : {}),
      }),
    },
  }));
  const result = await dispatch('/apple', { body: { signedPayload: 'signed' } });
  assert.equal(result.status, 204);
  assert.deepEqual(state.users[0], { $pull: { purchasedBooks: 'book' } });
});

test('Apple refuses unverified notifications without modifying ownership', async () => {
  const state = ledger();
  mock.method(service, 'applePurchaseClient', () => ({ verifier: {
    verifyAndDecodeNotification: async () => { throw new Error('bad signature'); },
  } }));
  const result = await dispatch('/apple', { body: { signedPayload: 'forged' } });
  assert.equal(result.error.statusCode, 401);
  assert.equal(state.changes.length, 0);
});
