const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateProductionConfiguration } = require('../dist/config/env');
const { env } = require('../dist/config/env');
const { testOtpResponse, assertPhoneOtpDeliveryAvailable } = require('../dist/controllers/authController');

const base = {
  nodeEnv: 'production',
  jwtSecret: 'runtime-secret-value',
  adminEmail: 'owner@example.test',
  resendApiKey: 'resend-test-key',
  resendFromEmail: 'no-reply@example.test',
};

test('production rejects test/live phone modes and requires email delivery configuration', () => {
  assert.throws(
    () => validateProductionConfiguration({ ...base, whatsappOtpMode: 'test' }),
    /WHATSAPP_OTP_MODE.*disabled/,
  );
  assert.throws(
    () => validateProductionConfiguration({ ...base, whatsappOtpMode: 'live' }),
    /WHATSAPP_OTP_MODE.*disabled/,
  );
  assert.throws(
    () => validateProductionConfiguration({ ...base, whatsappOtpMode: 'disabled', resendApiKey: '' }),
    /RESEND_API_KEY/,
  );
  assert.throws(
    () => validateProductionConfiguration({ ...base, whatsappOtpMode: 'disabled', resendFromEmail: 'invalid' }),
    /RESEND_FROM_EMAIL/,
  );
  assert.doesNotThrow(() => validateProductionConfiguration({ ...base, whatsappOtpMode: 'disabled' }));
});

test('local and test environments may intentionally use generated test OTPs', () => {
  assert.doesNotThrow(() => validateProductionConfiguration({
    nodeEnv: 'development', jwtSecret: undefined, adminEmail: undefined, whatsappOtpMode: 'test',
  }));
});

test('phone test codes are never exposed outside explicit test mode', () => {
  const previous = env.WHATSAPP_OTP_MODE;
  try {
    env.WHATSAPP_OTP_MODE = 'disabled';
    assert.deepEqual(testOtpResponse('123456'), {});
    assert.throws(assertPhoneOtpDeliveryAvailable, /Phone OTP delivery is not configured/);
    env.WHATSAPP_OTP_MODE = 'test';
    assert.deepEqual(testOtpResponse('123456'), { testOtp: '123456' });
    assert.doesNotThrow(assertPhoneOtpDeliveryAvailable);
  } finally {
    env.WHATSAPP_OTP_MODE = previous;
  }
});
