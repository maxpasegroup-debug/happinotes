const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Otp, User } = require('../dist/models');
const { env } = require('../dist/config/env');
const deletion = require('../dist/services/accountDeletion');
const authController = require('../dist/controllers/authController');
const authRoutes = require('../dist/routes/authRoutes').default;

const EMAIL = 'person@example.test';
const PURPOSE = 'email-login';
const SECRET = env.JWT_SECRET;

afterEach(() => mock.restoreAll());

function otpHash(email, otp) {
  return crypto.createHmac('sha256', SECRET).update(`${email}:${otp}`).digest('hex');
}

function matchesChallenge(challenge, filter) {
  if (filter._id && String(filter._id) !== String(challenge._id)) return false;
  if (filter.identifier && filter.identifier !== challenge.identifier) return false;
  if (filter.purpose && filter.purpose !== challenge.purpose) return false;
  if (filter.otp && filter.otp !== challenge.otp) return false;
  if (filter.used === false && challenge.used !== false) return false;
  if (filter.expiresAt?.$gt && challenge.expiresAt <= filter.expiresAt.$gt) return false;
  if (filter.$or && !filter.$or.some((condition) => {
    if (condition.attempts?.$lt !== undefined) return challenge.attempts < condition.attempts.$lt;
    if (condition.attempts?.$exists === false) return challenge.attempts === undefined;
    return false;
  })) return false;
  return true;
}

function setup({ otp = '123456', attempts = 0, legacyAttempts = false, used = false, expiresAt } = {}) {
  const state = {
    challenge: {
      _id: 'email-otp-id',
      identifier: EMAIL,
      purpose: PURPOSE,
      otp: otpHash(EMAIL, otp),
      attempts,
      used,
      expiresAt: expiresAt ?? new Date(Date.now() + 5 * 60_000),
      createdAt: new Date(),
    },
    filters: [],
  };
  if (legacyAttempts) delete state.challenge.attempts;

  mock.method(Otp, 'findOne', (filter) => ({
    sort: async () => {
      state.filters.push(filter);
      return matchesChallenge(state.challenge, filter) ? { ...state.challenge } : null;
    },
  }));
  mock.method(Otp, 'findOneAndUpdate', async (filter, update, options) => {
    state.filters.push(filter);
    if (!matchesChallenge(state.challenge, filter)) return null;
    if (options?.sort) assert.deepEqual(options.sort, { createdAt: -1 });
    if (update.$inc?.attempts) state.challenge.attempts = (state.challenge.attempts ?? 0) + update.$inc.attempts;
    if (update.$set?.used !== undefined) state.challenge.used = update.$set.used;
    return { ...state.challenge };
  });
  return state;
}

function invoke(controller, body) {
  const result = { statusCode: 200, body: undefined, error: undefined };
  const res = {
    status(code) { result.statusCode = code; return this; },
    json(value) { result.body = value; return this; },
  };
  return Promise.resolve(controller({ body }, res, (error) => { result.error = error; })).then(() => result);
}

test('correct email OTP creates the existing ten-minute challenge exactly once', async () => {
  const state = setup();
  const result = await invoke(authController.verifyEmailOtp, { email: EMAIL, otp: '123456', purpose: 'login' });
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.success, true);
  const challenge = jwt.verify(result.body.emailChallenge, SECRET);
  assert.deepEqual({ email: challenge.email, type: challenge.type }, { email: EMAIL, type: PURPOSE });
  assert.equal(challenge.exp - challenge.iat, 600);
  assert.equal(state.challenge.used, true);

  const replay = await invoke(authController.verifyEmailOtp, { email: EMAIL, otp: '123456', purpose: 'login' });
  assert.equal(replay.statusCode, 200);
  assert.equal(replay.error?.statusCode, 400);
  assert.equal(replay.body, undefined);
});

test('incorrect email OTP attempts persist and the challenge is exhausted after five', async () => {
  const state = setup();
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const result = await invoke(authController.verifyEmailOtp, { email: EMAIL, otp: '000000', purpose: 'login' });
    assert.equal(result.error?.statusCode, 400);
    assert.equal(state.challenge.attempts, attempt);
  }
  const attemptsAtLimit = state.challenge.attempts;
  const correctAfterLimit = await invoke(authController.verifyEmailOtp, { email: EMAIL, otp: '123456', purpose: 'login' });
  assert.equal(correctAfterLimit.error?.statusCode, 400);
  assert.equal(state.challenge.attempts, attemptsAtLimit);
  assert.equal(state.challenge.used, false);
});

test('a legacy challenge without attempts starts at zero and receives an atomic counter', async () => {
  const state = setup({ legacyAttempts: true });
  const wrong = await invoke(authController.verifyEmailOtp, { email: EMAIL, otp: '000000', purpose: 'login' });
  assert.equal(wrong.error?.statusCode, 400);
  assert.equal(state.challenge.attempts, 1);
  const correct = await invoke(authController.verifyEmailOtp, { email: EMAIL, otp: '123456', purpose: 'login' });
  assert.equal(correct.body?.success, true);
  assert.equal(state.challenge.used, true);
});

test('expired, used, and exhausted email OTP challenges are rejected', async (t) => {
  for (const [label, options] of [
    ['expired', { expiresAt: new Date(Date.now() - 1) }],
    ['used', { used: true }],
    ['exhausted', { attempts: 5 }],
  ]) {
    await t.test(label, async () => {
      const state = setup(options);
      const result = await invoke(authController.verifyEmailOtp, { email: EMAIL, otp: '123456', purpose: 'login' });
      assert.equal(result.error?.statusCode, 400);
      assert.equal(state.challenge.used, options.used ?? false);
      assert.equal(state.challenge.attempts, options.attempts ?? 0);
    });
  }
});

test('concurrent correct email OTP requests can consume one challenge only once', async () => {
  const state = setup();
  const results = await Promise.all(Array.from({ length: 12 }, () =>
    invoke(authController.verifyEmailOtp, { email: EMAIL, otp: '123456', purpose: 'login' })));
  assert.equal(results.filter((result) => result.body?.success === true).length, 1);
  assert.equal(results.filter((result) => result.error?.statusCode === 400).length, 11);
  assert.equal(state.challenge.used, true);
});

test('concurrent incorrect email OTP attempts cannot increment beyond five', async () => {
  const state = setup();
  const results = await Promise.all(Array.from({ length: 20 }, () =>
    invoke(authController.verifyEmailOtp, { email: EMAIL, otp: '000000', purpose: 'login' })));
  assert.ok(results.every((result) => result.error?.statusCode === 400));
  assert.equal(state.challenge.attempts, 5);
  assert.equal(state.challenge.used, false);
});

test('email challenge still permits ordinary customer login', async () => {
  const state = setup();
  const verified = await invoke(authController.verifyEmailOtp, { email: EMAIL, otp: '123456', purpose: 'login' });
  const passwordHash = await bcrypt.hash('customer-password', 4);
  const user = {
    _id: 'customer-id', id: 'customer-id', name: 'Customer', email: EMAIL,
    password: passwordHash, role: 'user', purchasedBooks: [], blocked: false,
  };
  mock.method(User, 'findOne', () => ({ select: async () => user }));
  mock.method(deletion, 'isAccountWritable', async () => true);
  const login = await invoke(authController.login, {
    email: EMAIL, password: 'customer-password', emailChallenge: verified.body.emailChallenge,
  });
  assert.equal(login.error, undefined);
  assert.equal(login.body.success, true);
  const accessClaims = jwt.verify(login.body.token, SECRET);
  assert.equal(accessClaims.id, 'customer-id');
  assert.equal(accessClaims.sessionVersion, 0);
  assert.equal(state.challenge.used, true);
});

test('configured administrator email-password login remains compatible', async () => {
  const originalAdminEmail = env.ADMIN_EMAIL;
  env.ADMIN_EMAIL = 'admin@example.test';
  const passwordHash = await bcrypt.hash('admin-password', 4);
  const admin = {
    _id: 'admin-id', id: 'admin-id', name: 'Admin', email: 'admin@example.test',
    password: passwordHash, role: 'admin', purchasedBooks: [], blocked: false,
  };
  mock.method(User, 'findOne', () => ({ select: async () => admin }));
  mock.method(deletion, 'isAccountWritable', async () => true);
  try {
    const login = await invoke(authController.login, { email: admin.email, password: 'admin-password' });
    assert.equal(login.error, undefined);
    assert.equal(login.body.success, true);
    const accessClaims = jwt.verify(login.body.token, SECRET);
    assert.equal(accessClaims.id, 'admin-id');
    assert.equal(accessClaims.sessionVersion, 0);
  } finally {
    env.ADMIN_EMAIL = originalAdminEmail;
  }
});

test('signup uses the same authentication rate limiter without weakening other auth routes', () => {
  const route = (path) => authRoutes.stack.find((layer) => layer.route?.path === path).route;
  const signup = route('/signup');
  const login = route('/login');
  const emailOtp = route('/request-email-otp');
  const verifyOtp = route('/verify-email-otp');
  const forgotPassword = route('/forgot-password');
  const resetPassword = route('/reset-password');
  assert.equal(signup.stack[0].handle, login.stack[0].handle);
  assert.equal(login.stack[0].handle, emailOtp.stack[0].handle);
  assert.equal(emailOtp.stack[0].handle, verifyOtp.stack[0].handle);
  assert.equal(forgotPassword.stack[0].handle, resetPassword.stack[0].handle);
  assert.equal(login.stack[0].handle, forgotPassword.stack[0].handle);
});
