const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  validateProductionConfiguration,
  isStrongProductionJwtSecret,
  resolveRateLimitStoreConfiguration,
} = require('../dist/config/env');
const { env } = require('../dist/config/env');
const { testOtpResponse, assertPhoneOtpDeliveryAvailable } = require('../dist/controllers/authController');

const base = {
  nodeEnv: 'production',
  jwtSecret: 'A-valid-production-secret-32-bytes-minimum!',
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

test('production JWT policy rejects missing, short, weak, placeholder, and fallback secrets without echoing them', () => {
  const rejected = [undefined, '', 'short', 'a'.repeat(48), 'your-super-secret-jwt-key-change-in-production', 'fallback-secret-change-me'];
  for (const jwtSecret of rejected) {
    assert.equal(isStrongProductionJwtSecret(jwtSecret), false);
    assert.throws(
      () => validateProductionConfiguration({ ...base, jwtSecret, whatsappOtpMode: 'disabled' }),
      (error) => {
        assert.match(error.message, /JWT_SECRET/);
        assert.equal(jwtSecret ? error.message.includes(jwtSecret) : false, false);
        return true;
      },
    );
  }
  assert.equal(isStrongProductionJwtSecret(base.jwtSecret), true);
  assert.doesNotThrow(() => validateProductionConfiguration({ ...base, whatsappOtpMode: 'disabled' }));
});

test('missing production shared limiter configuration is explicit process-local memory, not shared', () => {
  assert.deepEqual(resolveRateLimitStoreConfiguration(undefined, 'production'), {
    mode: 'memory', shared: false, warning: true,
  });
  assert.deepEqual(resolveRateLimitStoreConfiguration('memory', 'development'), {
    mode: 'memory', shared: false, warning: false,
  });
  assert.throws(
    () => resolveRateLimitStoreConfiguration('redis', 'production'),
    /unsupported.*process-local memory store/,
  );
  assert.throws(
    () => validateProductionConfiguration({ ...base, whatsappOtpMode: 'disabled', rateLimitStore: 'redis' }),
    /RATE_LIMIT_STORE.*unsupported/,
  );
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
