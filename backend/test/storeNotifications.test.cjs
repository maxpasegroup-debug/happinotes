const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { OAuth2Client } = require('google-auth-library');
const { Type } = require('@apple/app-store-server-library');
const service = require('../dist/services/storePurchase');
const subscriptionService = require('../dist/services/subscriptionPurchase');
const { StorePurchase } = require('../dist/models/StorePurchase');
const { SubscriptionPurchase } = require('../dist/models/SubscriptionPurchase');
const { User } = require('../dist/models');
const { AccountDeletionRequest } = require('../dist/models/AccountDeletionRequest');
const notificationRoutes = require('../dist/routes/storeNotificationRoutes');
const router = notificationRoutes.default;

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
  // Apple non-consumable fixtures do not include a subscription claim. Keep
  // the unrelated lifecycle lookup deterministic instead of waiting on Mongo.
  mock.method(SubscriptionPurchase, 'findOne', async () => null);
  mock.method(StorePurchase, 'updateOne', async (_, update) => { changes.push(update); });
  mock.method(StorePurchase, 'exists', async () => otherPurchase);
  mock.method(User, 'updateOne', async (_, update) => { users.push(update); });
  mock.method(User, 'findById', () => ({ select: async () => ({ blocked: false, deletionState: 'active' }) }));
  mock.method(AccountDeletionRequest, 'exists', async () => false);
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

test('Google subscription notification ownership must match the existing ledger claim', () => {
  const { googleNotificationClaimMatches } = notificationRoutes;
  assert.equal(googleNotificationClaimMatches({ userId: 'user' }, service.accountToken('user')), true);
  assert.equal(googleNotificationClaimMatches({ userId: 'user' }, service.accountToken('other-user')), false);
  assert.equal(googleNotificationClaimMatches({ userId: 'user' }, undefined), false);
});

test('Google RTDN updates only an existing same-owner subscription claim', async () => {
  const req = googleIdentity();
  req.body.message.data = Buffer.from(JSON.stringify({
    packageName: 'com.happinotes.test',
    subscriptionNotification: { purchaseToken: 'subscription-token', subscriptionId: 'premium.monthly' },
  })).toString('base64');
  const changes = [];
  const updates = [];
  mock.method(AccountDeletionRequest, 'exists', async () => false);
  const claim = { _id: 'subclaim', userId: 'user', planKey: 'monthly', productId: 'premium.monthly', store: 'android' };
  mock.method(SubscriptionPurchase, 'findOne', async () => claim);
  mock.method(SubscriptionPurchase, 'updateOne', async (_, update) => { changes.push(update); });
  mock.method(User, 'findById', () => ({ select: async () => ({ subscription: undefined }) }));
  mock.method(User, 'updateOne', async (_, update) => { updates.push(update); return { matchedCount: 1 }; });
  mock.method(subscriptionService, 'googleSubscriptionNotification', async () => ({
    transactionKey: 'stable-key', active: true, expiresAt: new Date(Date.now() + 60_000),
    autoRenewing: true, externalAccountId: service.accountToken('user'),
  }));
  const result = await dispatch('/google', req);
  assert.equal(result.status, 204);
  assert.equal(changes.length, 1);
  assert.equal(updates.length, 1);
});

test('Google RTDN cannot update an existing claim for another account', async () => {
  const req = googleIdentity();
  req.body.message.data = Buffer.from(JSON.stringify({
    packageName: 'com.happinotes.test',
    subscriptionNotification: { purchaseToken: 'subscription-token', subscriptionId: 'premium.monthly' },
  })).toString('base64');
  const claim = { _id: 'subclaim', userId: 'user', planKey: 'monthly', productId: 'premium.monthly', store: 'android' };
  mock.method(SubscriptionPurchase, 'findOne', async () => claim);
  mock.method(subscriptionService, 'googleSubscriptionNotification', async () => ({
    transactionKey: 'stable-key', active: true, expiresAt: new Date(Date.now() + 60_000),
    autoRenewing: true, externalAccountId: service.accountToken('other-user'),
  }));
  const result = await dispatch('/google', req);
  assert.equal(result.error.statusCode, 400);
});

test('duplicate RTDN delivery is idempotent for the existing owner claim', async () => {
  const req = googleIdentity();
  req.body.message.data = Buffer.from(JSON.stringify({
    packageName: 'com.happinotes.test',
    subscriptionNotification: { purchaseToken: 'subscription-token', subscriptionId: 'premium.monthly' },
  })).toString('base64');
  const claim = { _id: 'subclaim', userId: 'user', planKey: 'monthly', productId: 'premium.monthly', store: 'android' };
  let ledgerWrites = 0;
  let entitlementWrites = 0;
  mock.method(AccountDeletionRequest, 'exists', async () => false);
  mock.method(SubscriptionPurchase, 'findOne', async () => claim);
  mock.method(SubscriptionPurchase, 'updateOne', async () => { ledgerWrites += 1; });
  mock.method(User, 'findById', () => ({ select: async () => ({ subscription: {
    store: 'android', planKey: 'monthly', productId: 'premium.monthly', transactionKey: 'stable-key',
    active: true, expiresAt: new Date(Date.now() + 60_000), autoRenewing: true,
  } }) }));
  mock.method(User, 'updateOne', async () => { entitlementWrites += 1; return { matchedCount: 1 }; });
  mock.method(subscriptionService, 'googleSubscriptionNotification', async () => ({
    transactionKey: 'stable-key', active: true, expiresAt: new Date(Date.now() + 60_000),
    autoRenewing: true, externalAccountId: service.accountToken('user'),
  }));
  assert.equal((await dispatch('/google', req)).status, 204);
  assert.equal((await dispatch('/google', req)).status, 204);
  assert.equal(ledgerWrites, 2);
  assert.equal(entitlementWrites, 2);
});

test('RTDN records provider state but cannot grant entitlement after deletion begins', async () => {
  const req = googleIdentity();
  req.body.message.data = Buffer.from(JSON.stringify({
    packageName: 'com.happinotes.test',
    subscriptionNotification: { purchaseToken: 'subscription-token', subscriptionId: 'premium.monthly' },
  })).toString('base64');
  const claim = { _id: 'subclaim', userId: 'user', planKey: 'monthly', productId: 'premium.monthly', store: 'android' };
  let entitlementWrites = 0;
  mock.method(SubscriptionPurchase, 'findOne', async () => claim);
  mock.method(SubscriptionPurchase, 'updateOne', async () => {});
  mock.method(AccountDeletionRequest, 'exists', async () => true);
  mock.method(User, 'findById', () => ({ select: async () => ({ blocked: false, deletionState: 'active', subscription: undefined }) }));
  mock.method(User, 'updateOne', async () => { entitlementWrites += 1; });
  mock.method(subscriptionService, 'googleSubscriptionNotification', async () => ({
    transactionKey: 'stable-key', active: true, expiresAt: new Date(Date.now() + 60_000),
    autoRenewing: true, externalAccountId: service.accountToken('user'),
  }));
  const result = await dispatch('/google', req);
  assert.equal(result.status, 204);
  assert.equal(entitlementWrites, 0);
});

test('Google refund removes access when no other purchase is active', async () => {
  const req = googleIdentity();
  const state = ledger();
  mock.method(service, 'googlePurchase', async () => ({ purchase: {
    purchaseState: 1, obfuscatedExternalAccountId: service.accountToken('user'),
  } }));
  const result = await dispatch('/google', req);
  assert.equal(result.status, 204);
  assert.deepEqual(state.changes[0], { $set: { active: false } });
  assert.deepEqual(state.users[0], { $pull: { purchasedBooks: 'book' } });
});

test('a refund preserves access granted by another active store purchase', async () => {
  const req = googleIdentity();
  const state = ledger(true);
  mock.method(service, 'googlePurchase', async () => ({ purchase: {
    purchaseState: 1, obfuscatedExternalAccountId: service.accountToken('user'),
  } }));
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

test('Google one-time notifications reject a token whose verified owner differs', async () => {
  const req = googleIdentity();
  const state = ledger();
  mock.method(service, 'googlePurchase', async () => ({ purchase: {
    purchaseState: 0, consumptionState: 0, obfuscatedExternalAccountId: service.accountToken('other-user'),
  } }));
  const result = await dispatch('/google', req);
  assert.equal(result.error.statusCode, 400);
  assert.equal(state.changes.length, 0);
  assert.equal(state.users.length, 0);
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

test('Apple subscription notifications refresh canonical status, preserving owner and handling duplicate or stale delivery', async () => {
  const { appleSubscriptionNotification } = require('../dist/services/subscriptionPurchase');
  const claim = { _id: 'subscription-claim', userId: 'user', planKey: 'monthly',
    productId: 'premium.monthly', store: 'ios' };
  const writes = [];
  const userWrites = [];
  mock.method(service, 'applePurchaseClient', () => ({
    environment: 'Sandbox',
    verifier: {
      verifyAndDecodeNotification: async () => ({ data: { signedTransactionInfo: 'notification-jws' } }),
      verifyAndDecodeTransaction: async () => ({ originalTransactionId: 'original', transactionId: 'old-tx' }),
    },
  }));
  mock.method(StorePurchase, 'findOne', async () => null);
  mock.method(SubscriptionPurchase, 'findOne', async () => claim);
  mock.method(SubscriptionPurchase, 'updateOne', async (filter, update) => {
    writes.push({ filter, update });
    return { matchedCount: 1 };
  });
  mock.method(AccountDeletionRequest, 'exists', async () => false);
  mock.method(User, 'findById', () => ({ select: async () => ({ subscription: undefined }) }));
  mock.method(User, 'updateOne', async (_, update) => { userWrites.push(update); return { matchedCount: 1 }; });
  let statusLookups = 0;
  mock.method(require('../dist/services/subscriptionPurchase'), 'appleSubscriptionNotification', async (original, product, owner) => {
    statusLookups += 1;
    assert.equal(original, 'original');
    assert.equal(product, 'premium.monthly');
    assert.equal(owner, service.accountToken('user'));
    // Apple status is refreshed on every notification; delivery order does not
    // supply the state that is applied.
    return { transactionKey: 'Sandbox:original', active: true,
      expiresAt: new Date(Date.now() + 60_000), autoRenewing: false,
      providerStateSignedAt: new Date('2026-10-24T10:00:00Z') };
  });
  const request = { body: { signedPayload: 'signed-notification' } };
  assert.equal((await dispatch('/apple', request)).status, 204);
  assert.equal((await dispatch('/apple', request)).status, 204);
  assert.equal(statusLookups, 2);
  assert.equal(writes.length, 2);
  assert.equal(userWrites.length, 2);
  assert.equal(writes[0].update.$set.active, true);
  assert.equal(writes[0].filter.$or[0].providerStateSignedAt.$lte.toISOString(), '2026-10-24T10:00:00.000Z');
});

test('an Apple lifecycle response older than the persisted signed state cannot alter user entitlement', async () => {
  const claim = { _id: 'subscription-claim', userId: 'user', planKey: 'monthly',
    productId: 'premium.monthly', store: 'ios' };
  let entitlementWrites = 0;
  mock.method(service, 'applePurchaseClient', () => ({
    environment: 'Sandbox',
    verifier: {
      verifyAndDecodeNotification: async () => ({ data: { signedTransactionInfo: 'notification-jws' } }),
      verifyAndDecodeTransaction: async () => ({ originalTransactionId: 'original', transactionId: 'old-tx' }),
    },
  }));
  mock.method(StorePurchase, 'findOne', async () => null);
  mock.method(SubscriptionPurchase, 'findOne', async () => claim);
  mock.method(SubscriptionPurchase, 'updateOne', async () => ({ matchedCount: 0 }));
  mock.method(AccountDeletionRequest, 'exists', async () => false);
  mock.method(User, 'findById', () => ({ select: async () => ({ subscription: undefined }) }));
  mock.method(User, 'updateOne', async () => { entitlementWrites += 1; return { matchedCount: 1 }; });
  mock.method(require('../dist/services/subscriptionPurchase'), 'appleSubscriptionNotification', async () => ({
    transactionKey: 'Sandbox:original', active: false,
    providerStateSignedAt: new Date('2026-10-24T09:00:00Z'),
  }));
  const result = await dispatch('/apple', { body: { signedPayload: 'signed-notification' } });
  assert.equal(result.status, 204);
  assert.equal(entitlementWrites, 0);
});

test('Apple renewal-only notifications are signature-checked and refresh the existing subscription chain', async () => {
  const claim = { _id: 'subscription-claim', userId: 'user', planKey: 'monthly',
    productId: 'premium.monthly', store: 'ios' };
  let refreshed = false;
  mock.method(service, 'applePurchaseClient', () => ({
    environment: 'Sandbox',
    verifier: {
      verifyAndDecodeNotification: async () => ({ data: { signedRenewalInfo: 'renewal-jws' } }),
      verifyAndDecodeRenewalInfo: async (signed) => {
        assert.equal(signed, 'renewal-jws');
        return { originalTransactionId: 'original' };
      },
    },
  }));
  mock.method(StorePurchase, 'findOne', async () => { throw new Error('no transaction is expected'); });
  mock.method(SubscriptionPurchase, 'findOne', async () => claim);
  mock.method(SubscriptionPurchase, 'updateOne', async () => ({ matchedCount: 1 }));
  mock.method(AccountDeletionRequest, 'exists', async () => false);
  mock.method(User, 'findById', () => ({ select: async () => ({ subscription: undefined }) }));
  mock.method(User, 'updateOne', async () => ({ matchedCount: 1 }));
  mock.method(require('../dist/services/subscriptionPurchase'), 'appleSubscriptionNotification', async (original, product, owner) => {
    assert.equal(original, 'original');
    assert.equal(product, 'premium.monthly');
    assert.equal(owner, service.accountToken('user'));
    refreshed = true;
    return { transactionKey: 'Sandbox:original', active: true,
      expiresAt: new Date(Date.now() + 60_000), providerStateSignedAt: new Date() };
  });
  const result = await dispatch('/apple', { body: { signedPayload: 'signed-notification' } });
  assert.equal(result.status, 204);
  assert.equal(refreshed, true);
});
