const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../dist/models');
const { AccountDeletionRequest } = require('../dist/models/AccountDeletionRequest');
const { PasswordResetToken } = require('../dist/models/passwordResetToken');
const { env } = require('../dist/config/env');
const deletion = require('../dist/services/accountDeletion');
const emailServicePath = require.resolve('../dist/services/emailService');
const emailServiceModule = new Module(emailServicePath);
emailServiceModule.filename = emailServicePath;
emailServiceModule.loaded = true;
emailServiceModule.exports = { sendOTPEmail: async () => {} };
require.cache[emailServicePath] = emailServiceModule;
const emailService = require(emailServicePath);
const authController = require('../dist/controllers/authController');
const authRoutes = require('../dist/routes/authRoutes').default;
const { authenticate, optionalAuthenticate } = require('../dist/middleware/auth');
const { requireAdmin } = require('../dist/middleware/admin');

afterEach(() => mock.restoreAll());

async function setup({ userExists = true, expiresAt, attempts = 0, updateMatchedCount = 1, updateError } = {}) {
  const compareOtp = bcrypt.compare;
  const state = {
    token: userExists
      ? {
          _id: 'reset-token-id',
          userId: 'user-id',
          otpHash: await bcrypt.hash('123456', 4),
          expiresAt: expiresAt ?? new Date(Date.now() + 60_000),
          attempts,
        }
      : null,
    user: userExists
      ? {
          _id: 'user-id',
          password: await bcrypt.hash('old-password', 4),
          sessionVersion: 0,
          deletionState: 'active',
          save: async () => { state.saved += 1; },
        }
      : null,
    saved: 0,
    deleted: [],
    compareCalls: 0,
    passwordUpdates: [],
  };

  mock.method(User, 'findOne', () => ({
    select: async () => state.user,
    then: (resolve, reject) => Promise.resolve(state.user).then(resolve, reject),
  }));
  mock.method(User, 'updateOne', async (filter, update) => {
    state.passwordUpdates.push({ filter, update });
    if (updateError) throw updateError;
    if (state.user && String(filter._id) === String(state.user._id) && updateMatchedCount === 1) {
      state.user.password = update.$set.password;
      state.user.sessionVersion = (state.user.sessionVersion ?? 0) + update.$inc.sessionVersion;
    }
    return { matchedCount: updateMatchedCount };
  });
  mock.method(deletion, 'isAccountWritable', async () => true);
  mock.method(PasswordResetToken, 'findOne', () => ({
    sort: async (sort) => {
      assert.deepEqual(sort, { createdAt: -1 });
      return state.token ? { ...state.token } : null;
    },
  }));
  mock.method(bcrypt, 'compare', async (...args) => {
    state.compareCalls += 1;
    return compareOtp(...args);
  });

  mock.method(PasswordResetToken, 'updateOne', async (filter, update) => {
    const token = state.token;
    if (!token || String(token._id) !== String(filter._id) || token.consumedAt ||
        token.expiresAt <= filter.expiresAt.$gt || token.attempts >= filter.attempts.$lt) {
      return { matchedCount: 0 };
    }
    token.attempts += update.$inc.attempts;
    return { matchedCount: 1 };
  });
  mock.method(PasswordResetToken, 'findOneAndUpdate', async (filter, update) => {
    const token = state.token;
    if (!token || String(token._id) !== String(filter._id) || token.consumedAt ||
        token.attempts !== filter.attempts || token.expiresAt <= filter.expiresAt.$gt) {
      return null;
    }
    token.consumedAt = update.$set.consumedAt;
    return { ...token };
  });
  mock.method(PasswordResetToken, 'deleteMany', async (filter) => {
    state.deleted.push({ many: filter });
    if (state.token && String(state.token.userId) === String(filter.userId)) state.token = null;
    return { deletedCount: 1 };
  });
  mock.method(PasswordResetToken, 'deleteOne', async (filter) => {
    state.deleted.push({ one: filter });
    if (state.token && String(state.token._id) === String(filter._id)) state.token = null;
    return { deletedCount: 1 };
  });

  return state;
}

function invoke(controller, body) {
  const result = { statusCode: 200, body: undefined, error: undefined };
  const res = {
    status(code) { result.statusCode = code; return this; },
    json(value) { result.body = value; return this; },
  };
  return Promise.resolve(controller(
    { body },
    res,
    (error) => { result.error = error; },
  )).then(() => result);
}

test('wrong reset OTPs increment the persisted attempt count atomically', async () => {
  const state = await setup();
  const result = await invoke(authController.resetPassword, {
    email: 'person@example.test', otp: '000000', newPassword: 'new-password',
  });
  assert.equal(result.statusCode, 400);
  assert.deepEqual(result.body, { message: 'Invalid or expired OTP' });
  assert.equal(state.token.attempts, 1);
  assert.equal(state.saved, 0);
});

test('the fifth wrong OTP locks the token and later reset attempts do not compare again', async () => {
  const state = await setup();
  for (let i = 0; i < 5; i += 1) {
    const result = await invoke(authController.resetPassword, {
      email: 'person@example.test', otp: '000000', newPassword: 'new-password',
    });
    assert.equal(result.statusCode, 400);
  }
  const comparisonsAtLimit = state.compareCalls;
  const result = await invoke(authController.resetPassword, {
    email: 'person@example.test', otp: '123456', newPassword: 'new-password',
  });
  assert.equal(result.statusCode, 400);
  assert.equal(result.body.message, 'Invalid or expired OTP');
  assert.equal(state.token.attempts, 5);
  assert.equal(state.compareCalls, comparisonsAtLimit);
  assert.equal(state.saved, 0);
});

test('expired reset OTPs are rejected without comparison or password change', async () => {
  const state = await setup({ expiresAt: new Date(Date.now() - 1) });
  const result = await invoke(authController.resetPassword, {
    email: 'person@example.test', otp: '123456', newPassword: 'new-password',
  });
  assert.equal(result.statusCode, 400);
  assert.equal(result.body.message, 'Invalid or expired OTP');
  assert.equal(state.compareCalls, 0);
  assert.equal(state.saved, 0);
});

test('a successful reset hashes the new password and consumes the OTP once', async () => {
  const state = await setup();
  const result = await invoke(authController.resetPassword, {
    email: 'person@example.test', otp: '123456', newPassword: 'new-password',
  });
  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.body, { message: 'Password reset successful' });
  assert.equal(state.saved, 0);
  assert.equal(state.passwordUpdates.length, 1);
  assert.equal(await bcrypt.compare('new-password', state.user.password), true);
  assert.equal(state.user.sessionVersion, 1);
  assert.deepEqual(state.passwordUpdates[0].filter, { _id: 'user-id' });
  assert.equal(typeof state.passwordUpdates[0].update.$set.password, 'string');
  assert.deepEqual(state.passwordUpdates[0].update.$inc, { sessionVersion: 1 });
  assert.deepEqual(state.deleted, [{ many: { userId: 'user-id' } }]);
});

test('password update failure does not persist a new password or revoke sessions partially', async () => {
  const failure = new Error('database update failed');
  const state = await setup({ updateError: failure });
  const result = await invoke(authController.resetPassword, {
    email: 'person@example.test', otp: '123456', newPassword: 'new-password',
  });
  assert.equal(result.error, failure);
  assert.equal(await bcrypt.compare('old-password', state.user.password), true);
  assert.equal(state.user.sessionVersion, 0);
  assert.equal(state.passwordUpdates.length, 1);
  assert.deepEqual(state.deleted, []);
});

test('a missing user match cannot return successful password reset', async () => {
  const state = await setup({ updateMatchedCount: 0 });
  const result = await invoke(authController.resetPassword, {
    email: 'person@example.test', otp: '123456', newPassword: 'new-password',
  });
  assert.equal(result.statusCode, 400);
  assert.deepEqual(result.body, { message: 'Invalid or expired OTP' });
  assert.equal(await bcrypt.compare('old-password', state.user.password), true);
  assert.equal(state.user.sessionVersion, 0);
  assert.deepEqual(state.deleted, []);
});

test('a token issued before reset is rejected afterward and a new token works', async () => {
  const state = await setup();
  mock.method(User, 'findById', async () => state.user);
  mock.method(AccountDeletionRequest, 'exists', async () => false);
  const oldToken = jwt.sign({ id: 'user-id' }, env.JWT_SECRET, { expiresIn: '5m' });

  const authenticateToken = async (token) => {
    const req = { headers: { authorization: `Bearer ${token}` } };
    let error;
    await authenticate(req, {}, (value) => { error = value; });
    return { req, error };
  };

  const beforeReset = await authenticateToken(oldToken);
  assert.equal(beforeReset.error, undefined);
  assert.equal(beforeReset.req.user, state.user);

  const reset = await invoke(authController.resetPassword, {
    email: 'person@example.test', otp: '123456', newPassword: 'new-password',
  });
  assert.equal(reset.statusCode, 200);
  assert.equal(state.user.sessionVersion, 1);

  const afterReset = await authenticateToken(oldToken);
  assert.equal(afterReset.error.statusCode, 401);
  const emailChallenge = jwt.sign(
    { email: 'person@example.test', type: 'email-login' },
    env.JWT_SECRET,
    { expiresIn: '10m' },
  );
  const login = await invoke(authController.login, {
    email: 'person@example.test', password: 'new-password', emailChallenge,
  });
  assert.equal(login.error, undefined);
  assert.equal(jwt.verify(login.body.token, env.JWT_SECRET).sessionVersion, 1);
  const afterLogin = await authenticateToken(login.body.token);
  assert.equal(afterLogin.error, undefined);
  assert.equal(afterLogin.req.user, state.user);
});

test('resetting one user does not revoke another user’s legacy session', async () => {
  const state = await setup();
  const otherUser = { _id: 'other-id', sessionVersion: 0, blocked: false, deletionState: 'active' };
  mock.method(User, 'findById', async (id) => String(id) === 'user-id' ? state.user : otherUser);
  mock.method(AccountDeletionRequest, 'exists', async () => false);
  const otherToken = jwt.sign({ id: 'other-id' }, env.JWT_SECRET, { expiresIn: '5m' });

  const reset = await invoke(authController.resetPassword, {
    email: 'person@example.test', otp: '123456', newPassword: 'new-password',
  });
  assert.equal(reset.statusCode, 200);
  assert.equal(state.user.sessionVersion, 1);

  const req = { headers: { authorization: `Bearer ${otherToken}` } };
  let error;
  await authenticate(req, {}, (value) => { error = value; });
  assert.equal(error, undefined);
  assert.equal(req.user, otherUser);
});

test('optional authentication does not restore a revoked session', async () => {
  const state = await setup();
  state.user.sessionVersion = 1;
  mock.method(User, 'findById', async () => state.user);
  const oldToken = jwt.sign({ id: 'user-id' }, env.JWT_SECRET, { expiresIn: '5m' });
  const req = { headers: { authorization: `Bearer ${oldToken}` } };
  let error;
  await optionalAuthenticate(req, {}, (value) => { error = value; });
  assert.equal(error, undefined);
  assert.equal(req.user, undefined);
});

test('admin authorization uses the database role rather than a token role claim', async () => {
  const regularUser = { _id: 'regular-id', sessionVersion: 0, blocked: false, deletionState: 'active', role: 'user' };
  const adminUser = { _id: 'admin-id', sessionVersion: 0, blocked: false, deletionState: 'active', role: 'admin' };
  mock.method(User, 'findById', async (id) => String(id) === 'admin-id' ? adminUser : regularUser);
  mock.method(AccountDeletionRequest, 'exists', async () => false);

  const regularReq = { headers: { authorization: `Bearer ${jwt.sign({ id: 'regular-id', role: 'admin' }, env.JWT_SECRET)}` } };
  let error;
  await authenticate(regularReq, {}, (value) => { error = value; });
  assert.equal(error, undefined);
  requireAdmin(regularReq, {}, (value) => { error = value; });
  assert.equal(error.statusCode, 403);

  const adminReq = { headers: { authorization: `Bearer ${jwt.sign({ id: 'admin-id' }, env.JWT_SECRET)}` } };
  error = undefined;
  await authenticate(adminReq, {}, (value) => { error = value; });
  assert.equal(error, undefined);
  let authorized = false;
  requireAdmin(adminReq, {}, (value) => { assert.equal(value, undefined); authorized = true; });
  assert.equal(authorized, true);
});

test('a consumed OTP cannot be replayed', async () => {
  const state = await setup();
  const first = await invoke(authController.resetPassword, {
    email: 'person@example.test', otp: '123456', newPassword: 'new-password',
  });
  const second = await invoke(authController.resetPassword, {
    email: 'person@example.test', otp: '123456', newPassword: 'another-password',
  });
  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 400);
  assert.equal(second.body.message, 'Invalid or expired OTP');
  assert.equal(state.passwordUpdates.length, 1);
  assert.equal(state.user.sessionVersion, 1);
});

test('concurrent wrong guesses cannot increment beyond the persisted attempt limit', async () => {
  const state = await setup();
  const results = await Promise.all(Array.from({ length: 20 }, () => invoke(authController.resetPassword, {
    email: 'person@example.test', otp: '000000', newPassword: 'new-password',
  })));
  assert.equal(state.token.attempts, 5);
  assert.equal(state.saved, 0);
  assert.ok(results.every((result) => result.statusCode === 400));
});

test('concurrent successful resets can consume the OTP only once', async () => {
  const state = await setup();
  const results = await Promise.all([
    invoke(authController.resetPassword, {
      email: 'person@example.test', otp: '123456', newPassword: 'first-password',
    }),
    invoke(authController.resetPassword, {
      email: 'person@example.test', otp: '123456', newPassword: 'second-password',
    }),
  ]);
  assert.equal(results.filter((result) => result.statusCode === 200).length, 1);
  assert.equal(results.filter((result) => result.statusCode === 400).length, 1);
  assert.equal(state.passwordUpdates.length, 1);
  assert.equal(state.user.sessionVersion, 1);
});

test('unknown accounts and invalid reset codes receive the same response', async () => {
  const unknown = await setup({ userExists: false });
  const unknownResult = await invoke(authController.resetPassword, {
    email: 'missing@example.test', otp: '000000', newPassword: 'new-password',
  });
  mock.restoreAll();
  const existing = await setup();
  const invalidResult = await invoke(authController.resetPassword, {
    email: 'person@example.test', otp: '000000', newPassword: 'new-password',
  });
  assert.equal(unknown.user, null);
  assert.deepEqual(
    { statusCode: unknownResult.statusCode, body: unknownResult.body },
    { statusCode: invalidResult.statusCode, body: invalidResult.body },
  );
  assert.equal(existing.token.attempts, 1);
});

test('password reset shares the existing authentication rate limiter', () => {
  const resetRoute = authRoutes.stack.find((layer) => layer.route?.path === '/reset-password').route;
  const forgotRoute = authRoutes.stack.find((layer) => layer.route?.path === '/forgot-password').route;
  assert.equal(resetRoute.stack[0].handle, forgotRoute.stack[0].handle);
});

test('failed reset email delivery returns the same generic response as an unknown address', async () => {
  const state = await setup();
  mock.method(PasswordResetToken, 'create', async () => ({ _id: 'undelivered-token' }));
  mock.method(emailService, 'sendOTPEmail', async () => { throw new Error('provider failure'); });
  const result = await invoke(authController.forgotPassword, { email: 'person@example.test' });
  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.body, { message: 'If an account exists, an OTP has been sent.' });
  assert.deepEqual(state.deleted, [
    { many: { userId: 'user-id' } },
    { one: { _id: 'undelivered-token' } },
  ]);
  assert.equal(result.error, undefined);
});
