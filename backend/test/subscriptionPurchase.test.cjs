const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { GoogleAuth } = require('google-auth-library');
const { AutoRenewStatus, Status, Type } = require('@apple/app-store-server-library');
const storePurchaseService = require('../dist/services/storePurchase');
const {
  appleSubscription,
  appleSubscriptionNotification,
  googleSubscription,
  googleSubscriptionNotification,
  subscriptionTransactionKey,
} = require('../dist/services/subscriptionPurchase');

const initialEnv = { ...process.env };

afterEach(() => {
  mock.restoreAll();
  process.env = { ...initialEnv };
});

function playResponse(purchase, acknowledgementError) {
  process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON = '{}';
  process.env.GOOGLE_PLAY_PACKAGE_NAME = 'com.happinotes.test';
  const requests = [];
  mock.method(GoogleAuth.prototype, 'getClient', async () => ({
    request: async (request) => {
      requests.push(request);
      if (request.method === 'POST' && acknowledgementError) {
        const failure = typeof acknowledgementError === 'function' ? acknowledgementError() : acknowledgementError;
        if (failure) throw failure;
      }
      return { data: purchase };
    },
  }));
  return requests;
}

const activePurchase = (changes = {}) => ({
  subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
  acknowledgementState: 'ACKNOWLEDGEMENT_STATE_PENDING',
  externalAccountIdentifiers: { obfuscatedExternalAccountId: 'expected-account' },
  lineItems: [{ productId: 'premium.monthly', expiryTime: new Date(Date.now() + 60_000).toISOString(), autoRenewingPlan: { autoRenewEnabled: true } }],
  ...changes,
});

function appleStatus({ status = Status.ACTIVE, expiry = Date.now() + 60_000,
  graceExpiry, autoRenew = AutoRenewStatus.ON, revocationDate, account = 'expected-account',
  renewalAccount = account, signedDate = Date.now(), transactionProduct = 'premium.monthly' } = {}) {
  const checked = [];
  mock.method(storePurchaseService, 'applePurchaseClient', () => ({
    environment: 'Sandbox',
    client: {
      getTransactionInfo: async () => ({ signedTransactionInfo: 'purchase-jws' }),
      getAllSubscriptionStatuses: async (originalId) => {
        assert.equal(originalId, 'original-id');
        return { data: [{ lastTransactions: [{ status, signedTransactionInfo: 'current-jws', signedRenewalInfo: 'renewal-jws' }] }] };
      },
    },
    verifier: {
      verifyAndDecodeTransaction: async (signed) => {
        checked.push(signed);
        return {
          originalTransactionId: 'original-id', productId: transactionProduct,
          type: Type.AUTO_RENEWABLE_SUBSCRIPTION, appAccountToken: account,
          purchaseDate: Date.now() - 60_000, expiresDate: expiry, revocationDate,
          signedDate,
        };
      },
      verifyAndDecodeRenewalInfo: async (signed) => {
        checked.push(signed);
        return {
          originalTransactionId: 'original-id', appAccountToken: renewalAccount,
          autoRenewStatus: autoRenew, gracePeriodExpiresDate: graceExpiry,
          signedDate: signedDate - 1,
        };
      },
    },
  }));
  return checked;
}

test('Play subscription requires an exact account binding', async () => {
  for (const externalAccountIdentifiers of [undefined, {}, { obfuscatedExternalAccountId: 42 }, { obfuscatedExternalAccountId: '' }]) {
    const requests = playResponse(activePurchase({ externalAccountIdentifiers }));
    await assert.rejects(
      googleSubscription('premium.monthly', 'subscription-token', 'expected-account'),
      /invalid or belongs to another account/,
    );
    assert.equal(requests.length, 1);
  }

  const requests = playResponse(activePurchase({
    externalAccountIdentifiers: { obfuscatedExternalAccountId: 'different-account' },
  }));
  await assert.rejects(
    googleSubscription('premium.monthly', 'subscription-token', 'expected-account'),
    /invalid or belongs to another account/,
  );
  assert.equal(requests.length, 1);
});

test('Apple status lookup keeps a canceled subscription entitled only through expiry and reports renewal state', async () => {
  const checked = appleStatus({ autoRenew: AutoRenewStatus.OFF });
  const result = await appleSubscription('transaction-id', 'premium.monthly', 'expected-account');
  assert.equal(result.active, true);
  assert.equal(result.autoRenewing, false);
  assert.equal(result.transactionKey, 'Sandbox:original-id');
  assert.equal(checked.includes('renewal-jws'), true);
});

test('Apple verified grace period extends entitlement only to its signed grace expiry', async () => {
  appleStatus({ status: Status.BILLING_GRACE_PERIOD, expiry: Date.now() - 60_000,
    graceExpiry: Date.now() + 60_000 });
  const result = await appleSubscription('transaction-id', 'premium.monthly', 'expected-account');
  assert.equal(result.active, true);
  assert.ok(result.expiresAt.getTime() > Date.now());
});

test('Apple expired, billing retry without grace, and revoked states do not grant access', async () => {
  for (const options of [
    { status: Status.EXPIRED, expiry: Date.now() - 1 },
    { status: Status.BILLING_RETRY, expiry: Date.now() - 1 },
    { status: Status.ACTIVE, revocationDate: Date.now() },
  ]) {
    appleStatus(options);
    const result = await appleSubscription('transaction-id', 'premium.monthly', 'expected-account');
    assert.equal(result.active, false);
  }
});

test('Apple transaction and renewal account ownership must match the authenticated user', async () => {
  appleStatus({ account: 'another-account' });
  await assert.rejects(appleSubscription('transaction-id', 'premium.monthly', 'expected-account'), /another account/);
  appleStatus({ renewalAccount: 'another-account' });
  await assert.rejects(appleSubscription('transaction-id', 'premium.monthly', 'expected-account'), /another account/);
});

test('Apple status API failures fail closed with a retryable service error', async () => {
  mock.method(storePurchaseService, 'applePurchaseClient', () => ({
    client: { getTransactionInfo: async () => ({ signedTransactionInfo: 'purchase-jws' }),
      getAllSubscriptionStatuses: async () => { throw new Error('provider details'); } },
    verifier: { verifyAndDecodeTransaction: async () => ({
      originalTransactionId: 'original-id', productId: 'premium.monthly',
      type: Type.AUTO_RENEWABLE_SUBSCRIPTION, appAccountToken: 'expected-account',
    }) },
  }));
  await assert.rejects(appleSubscription('transaction-id', 'premium.monthly', 'expected-account'),
    (error) => error.statusCode === 503 && !error.message.includes('provider details'));
});

test('explicit restore can recover a missing Play binding, but not a mismatch', async () => {
  const requests = playResponse(activePurchase({ externalAccountIdentifiers: undefined }));
  const result = await googleSubscription(
    'premium.monthly', 'subscription-token', 'expected-account', { allowUnboundAccount: true },
  );
  assert.equal(result.active, true);
  assert.equal(requests.length, 2);

  playResponse(activePurchase({ externalAccountIdentifiers: { obfuscatedExternalAccountId: 'other' } }));
  await assert.rejects(
    googleSubscription('premium.monthly', 'subscription-token', 'expected-account', { allowUnboundAccount: true }),
    /invalid or belongs to another account/,
  );
});

test('already acknowledged subscriptions do not issue a second acknowledgement', async () => {
  const requests = playResponse(activePurchase({ acknowledgementState: 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED' }));
  await googleSubscription('premium.monthly', 'subscription-token', 'expected-account');
  assert.equal(requests.length, 1);
});

test('acknowledgement success is required before returning an active entitlement', async () => {
  const requests = playResponse(activePurchase());
  const result = await googleSubscription('premium.monthly', 'subscription-token', 'expected-account');
  assert.equal(result.active, true);
  assert.equal(requests.length, 2);
  assert.equal(requests[1].method, 'POST');
});

test('already-acknowledged provider responses are idempotent success', async () => {
  const requests = playResponse(activePurchase(), Object.assign(new Error('purchase already acknowledged'), { code: 409 }));
  const result = await googleSubscription('premium.monthly', 'subscription-token', 'expected-account');
  assert.equal(result.active, true);
  assert.equal(requests.length, 2);
});

test('misleading acknowledgement text without an explicit acknowledged outcome is rejected', async () => {
  const requests = playResponse(activePurchase(), Object.assign(new Error('purchase already acknowledged'), { code: 500 }));
  await assert.rejects(
    googleSubscription('premium.monthly', 'subscription-token', 'expected-account'),
    (failure) => failure.statusCode === 503 && /acknowledgement failed/.test(failure.message),
  );
  assert.equal(requests.length, 2);
});

test('a transient acknowledgement failure can be retried idempotently', async () => {
  let attempts = 0;
  const requests = playResponse(activePurchase(), () => {
    attempts += 1;
    return attempts === 1 ? new Error('temporary timeout') : null;
  });
  await assert.rejects(googleSubscription('premium.monthly', 'subscription-token', 'expected-account'), /acknowledgement failed/);
  const result = await googleSubscription('premium.monthly', 'subscription-token', 'expected-account');
  assert.equal(result.active, true);
  assert.equal(attempts, 2);
  assert.equal(requests.length, 4);
});

test('cancellation preserves access until the authoritative expiry', async () => {
  const requests = playResponse(activePurchase({
    subscriptionState: 'SUBSCRIPTION_STATE_CANCELED',
  }));
  const result = await googleSubscription('premium.monthly', 'subscription-token', 'expected-account');
  assert.equal(result.active, true);
  assert.equal(result.autoRenewing, false);
  assert.equal(requests.length, 2);
});

test('grace-period subscriptions retain access while expiry remains in the future', async () => {
  const requests = playResponse(activePurchase({
    subscriptionState: 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',
  }));
  const result = await googleSubscription('premium.monthly', 'subscription-token', 'expected-account');
  assert.equal(result.active, true);
  assert.equal(result.autoRenewing, true);
  assert.equal(requests.length, 2);
});

test('pending and canceled-after-expiry states do not grant access', async () => {
  for (const subscriptionState of ['SUBSCRIPTION_STATE_PENDING', 'SUBSCRIPTION_STATE_CANCELED']) {
    const requests = playResponse(activePurchase({
      subscriptionState,
      lineItems: [{ productId: 'premium.monthly', expiryTime: new Date(Date.now() - 60_000).toISOString() }],
    }));
    const result = await googleSubscription('premium.monthly', 'subscription-token', 'expected-account');
    assert.equal(result.active, false);
    assert.equal(requests.length, 1);
  }
});

test('expired, on-hold, and paused subscriptions do not grant access', async () => {
  for (const subscriptionState of [
    'SUBSCRIPTION_STATE_EXPIRED', 'SUBSCRIPTION_STATE_ON_HOLD', 'SUBSCRIPTION_STATE_PAUSED',
  ]) {
    const requests = playResponse(activePurchase({
      subscriptionState,
      lineItems: [{ productId: 'premium.monthly', expiryTime: new Date(Date.now() - 60_000).toISOString() }],
    }));
    const result = await googleSubscription('premium.monthly', 'subscription-token', 'expected-account');
    assert.equal(result.active, false);
    assert.equal(requests.length, 1);
  }
});

test('RTDN verification returns a stable claim key and the authoritative account binding', async () => {
  const requests = playResponse(activePurchase());
  const result = await googleSubscriptionNotification('premium.monthly', 'subscription-token');
  assert.equal(result.transactionKey, subscriptionTransactionKey('subscription-token'));
  assert.equal(result.externalAccountId, 'expected-account');
  assert.equal(result.active, true);
  assert.equal(requests.length, 2);
});

test('RTDN cancellation reports entitlement through expiry but disables auto-renewal', async () => {
  const requests = playResponse(activePurchase({
    subscriptionState: 'SUBSCRIPTION_STATE_CANCELED',
    lineItems: [{ productId: 'premium.monthly', expiryTime: new Date(Date.now() + 60_000).toISOString(),
      autoRenewingPlan: { autoRenewEnabled: false } }],
  }));
  const result = await googleSubscriptionNotification('premium.monthly', 'subscription-token');
  assert.equal(result.active, true);
  assert.equal(result.autoRenewing, false);
  assert.equal(requests.length, 2);
});

for (const [name, error] of [
  ['transient', new Error('timeout')],
  ['permanent', Object.assign(new Error('permission denied'), { code: 403 })],
]) {
  test(`acknowledgement ${name} failures block entitlement`, async () => {
    const requests = playResponse(activePurchase(), error);
    await assert.rejects(
      googleSubscription('premium.monthly', 'subscription-token', 'expected-account'),
      (failure) => failure.statusCode === 503 && /acknowledgement failed/.test(failure.message),
    );
    assert.equal(requests.length, 2);
  });
}

test('duplicate subscription tokens have one stable, non-secret ledger key', () => {
  assert.equal(subscriptionTransactionKey('subscription-token'), subscriptionTransactionKey('subscription-token'));
  assert.match(subscriptionTransactionKey('subscription-token'), /^[a-f\d]{64}$/);
  assert.notEqual(subscriptionTransactionKey('subscription-token'), 'subscription-token');
});
