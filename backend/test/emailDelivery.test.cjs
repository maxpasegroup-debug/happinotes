const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { Resend } = require('resend');
const { env } = require('../dist/config/env');
const { sendOTPEmail } = require('../dist/services/emailService');

const originalKey = env.RESEND_API_KEY;

afterEach(() => {
  mock.restoreAll();
  env.RESEND_API_KEY = originalKey;
});

test('email OTP delivery reports success only after Resend accepts it', async () => {
  env.RESEND_API_KEY = 'resend-test-key';
  const post = mock.method(Resend.prototype, 'post', async () => ({ data: { id: 'test-message' }, error: null }));
  await sendOTPEmail('test@example.test', '123456');
  assert.equal(post.mock.calls.length, 1);
});

test('missing Resend configuration fails before attempting delivery', async () => {
  env.RESEND_API_KEY = '';
  await assert.rejects(sendOTPEmail('test@example.test', '123456'), /RESEND_API_KEY/);
});

test('Resend provider errors are propagated as delivery failures', async () => {
  env.RESEND_API_KEY = 'resend-test-key';
  mock.method(Resend.prototype, 'post', async () => ({ data: null, error: { message: 'provider timeout' } }));
  await assert.rejects(sendOTPEmail('test@example.test', '123456'), /provider timeout/);
});
