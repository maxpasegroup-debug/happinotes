const { test } = require('node:test');
const assert = require('node:assert/strict');
const multer = require('multer');
const { errorHandler } = require('../dist/middleware/errorHandler');
const { BadRequestError } = require('../dist/utils/errors');

function invoke(error) {
  const result = { status: undefined, body: undefined };
  const response = {
    status(code) { result.status = code; return this; },
    json(body) { result.body = body; return this; },
  };
  errorHandler(error, {}, response, () => {});
  return result;
}

test('oversized uploads return a useful 413 response without stack details', () => {
  const result = invoke(new multer.MulterError('LIMIT_FILE_SIZE', 'lessonMedia'));
  assert.equal(result.status, 413);
  assert.match(result.body.message, /50 MB or smaller/);
  assert.equal(result.body.stack, undefined);
});

test('unsupported multipart file fields return a clear 400 response', () => {
  const result = invoke(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'executable'));
  assert.equal(result.status, 400);
  assert.match(result.body.message, /unsupported or unexpected file field/);
  assert.equal(result.body.stack, undefined);
});

test('rejected file types do not become generic internal server errors', () => {
  const result = invoke(new BadRequestError('Unsupported upload type. Use JPG/PNG/WebP images or MP3 audio.'));
  assert.equal(result.status, 400);
  assert.match(result.body.message, /Unsupported upload type/);
  assert.equal(result.body.stack, undefined);
});
