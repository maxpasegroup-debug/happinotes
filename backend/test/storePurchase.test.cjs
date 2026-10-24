const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { GoogleAuth } = require('google-auth-library');
const { AppStoreServerAPIClient, SignedDataVerifier, Type } = require('@apple/app-store-server-library');
const { accountToken, productMapping, verifyStorePurchase } = require('../dist/services/storePurchase');

afterEach(() => mock.restoreAll());

test('account binding is stable, UUID-shaped, and different for different users', () => {
  assert.match(accountToken('user-a'), /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-8[a-f\d]{3}-[a-f\d]{12}$/);
  assert.equal(accountToken('user-a'), accountToken('user-a'));
  assert.notEqual(accountToken('user-a'), accountToken('user-b'));
});

test('configuration rejects duplicate SKUs that could unlock the wrong book', () => {
  process.env.IAP_PRODUCTS_JSON = JSON.stringify({
    'aaaaaaaaaaaaaaaaaaaaaaaa': { android: 'book.one' },
    'bbbbbbbbbbbbbbbbbbbbbbbb': { android: 'book.one' },
  });
  assert.throws(productMapping, /duplicate/);
});

test('a shared SKU across different stores can map to the same book', () => {
  process.env.IAP_PRODUCTS_JSON = JSON.stringify({
    'aaaaaaaaaaaaaaaaaaaaaaaa': { android: 'book.one', ios: 'book.one' },
  });
  assert.equal(productMapping().aaaaaaaaaaaaaaaaaaaaaaaa.ios, 'book.one');
});

function playResponse(data, requests) {
  process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON = '{}';
  process.env.GOOGLE_PLAY_PACKAGE_NAME = 'com.happinotes.test';
  mock.method(GoogleAuth.prototype, 'getClient', async () => ({
    request: async (request) => {
      requests.push(request);
      return { data };
    },
  }));
}

for (const [name, changes] of [
  ['pending', { purchaseState: 2 }],
  ['cancelled', { purchaseState: 1 }],
  ['consumed', { consumptionState: 1 }],
  ['another account', { obfuscatedExternalAccountId: 'someone-else' }],
  ['missing account binding', { obfuscatedExternalAccountId: undefined }],
]) {
  test(`Play rejects ${name} purchases without acknowledging`, async () => {
    const requests = [];
    playResponse({ purchaseState: 0, consumptionState: 0, acknowledgementState: 0,
      obfuscatedExternalAccountId: 'expected', ...changes }, requests);
    await assert.rejects(verifyStorePurchase('android', 'book.one', 'secret-token', 'expected'));
    assert.equal(requests.length, 1);
  });
}

test('Play acknowledges a verified purchase and stores only its token hash', async () => {
  const requests = [];
  playResponse({ purchaseState: 0, consumptionState: 0, acknowledgementState: 0,
    obfuscatedExternalAccountId: 'expected' }, requests);
  const result = await verifyStorePurchase('android', 'book.one', 'secret-token', 'expected');
  assert.equal(requests.length, 2);
  assert.equal(requests[1].method, 'POST');
  assert.match(requests[1].url, /:acknowledge$/);
  assert.match(result.transactionKey, /^[a-f\d]{64}$/);
  assert.notEqual(result.transactionKey, 'secret-token');
});

test('Play restore of an acknowledged purchase does not acknowledge again', async () => {
  const requests = [];
  playResponse({ purchaseState: 0, consumptionState: 0, acknowledgementState: 1,
    obfuscatedExternalAccountId: 'expected' }, requests);
  await verifyStorePurchase('android', 'book.one', 'secret-token', 'expected');
  assert.equal(requests.length, 1);
});

test('Apple refuses to verify when store credentials are absent', async () => {
  const oldEnvironment = process.env.APPLE_IAP_ENVIRONMENT;
  const oldPrivateKey = process.env.APPLE_IAP_PRIVATE_KEY;
  delete process.env.APPLE_IAP_ENVIRONMENT;
  process.env.APPLE_IAP_PRIVATE_KEY = 'test-private-key-do-not-disclose';
  try {
    await assert.rejects(
      verifyStorePurchase('ios', 'book.one', '123', 'expected'),
      (error) => error.statusCode === 503 && error.message.includes('APPLE_IAP_ENVIRONMENT') &&
        !error.message.includes('test-private-key-do-not-disclose'),
    );
  } finally {
    if (oldEnvironment === undefined) delete process.env.APPLE_IAP_ENVIRONMENT;
    else process.env.APPLE_IAP_ENVIRONMENT = oldEnvironment;
    if (oldPrivateKey === undefined) delete process.env.APPLE_IAP_PRIVATE_KEY;
    else process.env.APPLE_IAP_PRIVATE_KEY = oldPrivateKey;
  }
});

function appleResponse(changes = {}) {
  Object.assign(process.env, {
    APPLE_IAP_ENVIRONMENT: 'Sandbox', APPLE_BUNDLE_ID: 'com.happinotes.test',
    APPLE_ROOT_CERTIFICATES_JSON: '[]', APPLE_IAP_PRIVATE_KEY: 'test',
    APPLE_IAP_KEY_ID: 'test', APPLE_IAP_ISSUER_ID: 'test',
  });
  mock.method(AppStoreServerAPIClient.prototype, 'getTransactionInfo', async () => ({ signedTransactionInfo: 'signed' }));
  mock.method(SignedDataVerifier.prototype, 'verifyAndDecodeTransaction', async () => ({
    productId: 'book.one', type: Type.NON_CONSUMABLE, appAccountToken: 'expected',
    originalTransactionId: '123', ...changes,
  }));
}

for (const [name, changes] of [
  ['wrong product', { productId: 'other.book' }],
  ['refunded', { revocationDate: Date.now() }],
  ['another account', { appAccountToken: 'someone-else' }],
  ['subscription', { type: Type.AUTO_RENEWABLE_SUBSCRIPTION }],
]) {
  test(`Apple rejects ${name} transactions`, async () => {
    appleResponse(changes);
    await assert.rejects(verifyStorePurchase('ios', 'book.one', '123', 'expected'));
  });
}

test('Apple accepts a verified non-consumable and uses its original transaction ID', async () => {
  appleResponse();
  assert.deepEqual(await verifyStorePurchase('ios', 'book.one', '123', 'expected'), {
    transactionKey: 'Sandbox:123',
  });
});
