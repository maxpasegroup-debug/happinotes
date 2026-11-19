const { test } = require('node:test');
const assert = require('node:assert/strict');
const { errorHandler } = require('../dist/middleware/errorHandler');

test('unexpected development errors return a generic response without reflecting sensitive details', () => {
  const sensitive = 'recipient@example.test otp=123456 api_key=sk_test_sensitive';
  const response = {
    statusCode: undefined,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };

  errorHandler(new Error(sensitive), {}, response, () => {});

  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.body, { success: false, message: 'Internal server error' });
  assert.equal(JSON.stringify(response.body).includes(sensitive), false);
});

test('operational messages keep their status and exclude environment diagnostics', () => {
  const { AppError } = require('../dist/utils/errors');
  const response = { status(code) { this.code = code; return this; }, json(value) { this.body = value; } };
  for (const sensitive of ['Missing SERVICE_URL in .env.local', 'Request failed at https://internal.invalid']) {
    errorHandler(new AppError(sensitive, 503), {}, response, () => {});
    assert.equal(response.code, 503);
    assert.equal(response.body.message, 'The request could not be completed. Please try again.');
  }
});
