const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const SENSITIVE = [
  'private-person@example.test',
  '654321',
  're_test_private_api_key',
  'Bearer test-authorization-secret',
  'provider-request-metadata-secret',
  'fcm-private-registration-token',
];

function captureLogs() {
  const output = [];
  for (const method of ['log', 'info', 'warn', 'error']) {
    mock.method(console, method, (...args) => output.push(JSON.stringify(args)));
  }
  return output;
}

function assertNoSensitiveValues(output) {
  const logs = output.join('\n');
  for (const value of SENSITIVE) assert.ok(!logs.includes(value), `sensitive log value found: ${value}`);
}

function installModuleStub(resolvedPath, exports) {
  const moduleStub = new Module(resolvedPath);
  moduleStub.filename = resolvedPath;
  moduleStub.loaded = true;
  moduleStub.exports = exports;
  require.cache[resolvedPath] = moduleStub;
}

const appModulePath = require.resolve('firebase-admin/app');
const messagingModulePath = require.resolve('firebase-admin/messaging');
const envModulePath = require.resolve('../dist/config/env');
const originalModules = new Map([
  [appModulePath, require.cache[appModulePath]],
  [messagingModulePath, require.cache[messagingModulePath]],
  [envModulePath, require.cache[envModulePath]],
]);

const unsafeInitializationError = new Error(
  `Firebase init ${SENSITIVE[0]} OTP ${SENSITIVE[1]} key ${SENSITIVE[2]} ${SENSITIVE[3]} ${SENSITIVE[4]}`,
);
unsafeInitializationError.metadata = { email: SENSITIVE[0], apiKey: SENSITIVE[2], request: SENSITIVE[4] };
installModuleStub(appModulePath, {
  cert: () => { throw unsafeInitializationError; },
  getApps: () => [],
  initializeApp: () => ({ name: 'unused' }),
});
installModuleStub(messagingModulePath, { getMessaging: () => null });
installModuleStub(envModulePath, {
  env: {
    FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({
      project_id: 'test-project',
      client_email: SENSITIVE[0],
      private_key: SENSITIVE[2],
    }),
  },
});

const firebaseAdmin = require('../dist/services/firebaseAdmin');
const { sendPushNotification } = require('../dist/services/pushNotification');

afterEach(() => {
  mock.restoreAll();
  for (const [path, original] of originalModules) {
    if (original) require.cache[path] = original;
    else delete require.cache[path];
  }
});

test('Firebase initialization failures omit service-account and nested error details', () => {
  const output = captureLogs();
  assert.equal(firebaseAdmin.getFirebaseMessaging(), null);
  assert.ok(output.join('\n').includes('firebase_admin_initialization_failed'));
  assertNoSensitiveValues(output);
});

test('Firebase push exceptions omit recipient tokens, message data, and provider metadata', async () => {
  const output = captureLogs();
  const unsafePushError = new Error(
    `push failed for ${SENSITIVE[0]} OTP ${SENSITIVE[1]} API ${SENSITIVE[2]} ${SENSITIVE[3]} ${SENSITIVE[4]} ${SENSITIVE[5]}`,
  );
  unsafePushError.metadata = {
    recipient: SENSITIVE[0], token: SENSITIVE[5], apiKey: SENSITIVE[2],
    authorization: SENSITIVE[3], request: SENSITIVE[4],
  };
  mock.method(firebaseAdmin, 'getFirebaseMessaging', () => ({
    sendEachForMulticast: async () => { throw unsafePushError; },
  }));

  const result = await sendPushNotification({
    tokens: [SENSITIVE[5]],
    title: SENSITIVE[0],
    message: `${SENSITIVE[1]} ${SENSITIVE[2]} ${SENSITIVE[4]}`,
    target: 'all',
  });

  assert.equal(result.error, 'Push delivery failed');
  assert.ok(output.join('\n').includes('push_delivery_failed'));
  assertNoSensitiveValues(output);
});

test('unknown Firebase error codes are reduced to a safe category', async () => {
  const output = captureLogs();
  mock.method(firebaseAdmin, 'getFirebaseMessaging', () => ({
    sendEachForMulticast: async () => ({
      successCount: 0,
      failureCount: 1,
      responses: [{ success: false, error: { code: `messaging/${SENSITIVE[0]}-${SENSITIVE[5]}` } }],
    }),
  }));

  const result = await sendPushNotification({
    tokens: [SENSITIVE[5]], title: 'title', message: 'message', target: 'all',
  });

  assert.deepEqual(result.failureCodes, { provider_error: 1 });
  assertNoSensitiveValues(output);
});
