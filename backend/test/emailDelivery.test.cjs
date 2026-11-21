const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { Resend } = require('resend');
const { env } = require('../dist/config/env');
const { sendOTPEmail } = require('../dist/services/emailService');

const originalKey = env.RESEND_API_KEY;
const SENSITIVE = [
  'private-person@example.test',
  '654321',
  're_test_private_api_key',
  'Bearer test-authorization-secret',
  'provider-request-metadata-secret',
];

function captureLogs() {
  const output = [];
  mock.method(console, 'info', (...args) => output.push(JSON.stringify(args)));
  mock.method(console, 'warn', (...args) => output.push(JSON.stringify(args)));
  mock.method(console, 'error', (...args) => output.push(JSON.stringify(args)));
  return output;
}

function assertNoSensitiveValues(output) {
  const logs = output.join('\n');
  for (const value of SENSITIVE) assert.ok(!logs.includes(value), `sensitive log value found: ${value}`);
}

afterEach(() => {
  mock.restoreAll();
  env.RESEND_API_KEY = originalKey;
});

test('email OTP delivery reports success only after Resend accepts it', async () => {
  env.RESEND_API_KEY = SENSITIVE[2];
  const output = captureLogs();
  const post = mock.method(Resend.prototype, 'post', async () => ({ data: { id: SENSITIVE[4] }, error: null }));
  await sendOTPEmail(SENSITIVE[0], SENSITIVE[1]);
  assert.equal(post.mock.calls.length, 1);
  assert.ok(output.join('\n').includes('email_delivery_succeeded'));
  assertNoSensitiveValues(output);
});

test('missing Resend configuration fails before attempting delivery', async () => {
  env.RESEND_API_KEY = '';
  const output = captureLogs();
  await assert.rejects(sendOTPEmail(SENSITIVE[0], SENSITIVE[1]), (error) => {
    assert.equal(error.name, 'EmailDeliveryError');
    assert.equal(error.category, 'configuration_missing');
    assert.equal(error.message, 'Email delivery failed');
    return true;
  });
  assert.ok(output.join('\n').includes('email_delivery_failed'));
  assertNoSensitiveValues(output);
});

test('Resend exceptions with private metadata are replaced by a safe delivery failure', async () => {
  env.RESEND_API_KEY = SENSITIVE[2];
  const output = captureLogs();
  const providerError = new Error(
    `delivery failed for ${SENSITIVE[0]} with OTP ${SENSITIVE[1]} and ${SENSITIVE[2]} ${SENSITIVE[3]} ${SENSITIVE[4]}`,
  );
  providerError.metadata = {
    recipient: SENSITIVE[0], otp: SENSITIVE[1], apiKey: SENSITIVE[2],
    authorization: SENSITIVE[3], request: SENSITIVE[4],
  };
  mock.method(Resend.prototype, 'post', async () => { throw providerError; });
  await assert.rejects(sendOTPEmail(SENSITIVE[0], SENSITIVE[1]), (error) => {
    assert.equal(error.name, 'EmailDeliveryError');
    assert.equal(error.category, 'provider_exception');
    assert.equal(error.message, 'Email delivery failed');
    assert.equal(error.cause, undefined);
    return true;
  });
  assert.ok(output.join('\n').includes('provider_exception'));
  assertNoSensitiveValues(output);
});

test('Resend rejected responses log only a fixed provider category', async () => {
  env.RESEND_API_KEY = SENSITIVE[2];
  const output = captureLogs();
  mock.method(Resend.prototype, 'post', async () => ({
    data: null,
    error: {
      name: `ProviderError ${SENSITIVE[0]}`,
      message: `OTP ${SENSITIVE[1]} key ${SENSITIVE[2]} ${SENSITIVE[3]} ${SENSITIVE[4]}`,
      metadata: { recipient: SENSITIVE[0], authorization: SENSITIVE[3] },
    },
  }));
  await assert.rejects(sendOTPEmail(SENSITIVE[0], SENSITIVE[1]), (error) => {
    assert.equal(error.category, 'provider_rejected');
    assert.equal(error.message, 'Email delivery failed');
    return true;
  });
  assert.ok(output.join('\n').includes('provider_rejected'));
  assertNoSensitiveValues(output);
});

test('admin messages use the OTP sender, a plain-text body and the provider retry key', async () => {
  env.RESEND_API_KEY = SENSITIVE[2];
  const output = captureLogs();
  const post = mock.method(Resend.prototype, 'post', async () => ({ data: { id: 'test-id' }, error: null }));
  await sendOTPEmail(SENSITIVE[0], SENSITIVE[1]);
  const { sendAdminEmail } = require('../dist/services/emailService');
  const body = 'First line\nSecond line <example>';
  await sendAdminEmail(SENSITIVE[0], 'An update', body, 'admin-mail-test');
  const [, otp] = post.mock.calls[0].arguments;
  const [, message, options] = post.mock.calls[1].arguments;
  assert.equal(message.from, otp.from);
  assert.deepEqual(message.to, [SENSITIVE[0]]);
  assert.equal(message.subject, 'An update');
  assert.equal(message.text, body);
  assert.equal(message.html, undefined);
  assert.equal(options.idempotencyKey, 'admin-mail-test');
  assertNoSensitiveValues(output);
});

test('formatted admin mail retains supported formatting and includes the plain-text alternative', async () => {
  env.RESEND_API_KEY = SENSITIVE[2];
  captureLogs();
  const post = mock.method(Resend.prototype, 'post', async () => ({ data: { id: 'test-id' }, error: null }));
  const { sendAdminEmail } = require('../dist/services/emailService');
  const html = '<p class="ignored"><strong>Hello</strong> <em>reader</em></p><ol start="3"><li><p><u>Update</u></p></li></ol><img src="https://example.test/pixel">';
  await sendAdminEmail(SENSITIVE[0], 'Update', 'Hello reader\nUpdate', 'format-test', html);
  const [, message, options] = post.mock.calls[0].arguments;
  assert.equal(message.html, '<p><strong>Hello</strong> <em>reader</em></p><ol start="3"><li><p><u>Update</u></p></li></ol>');
  assert.equal(message.text, 'Hello reader\nUpdate');
  assert.equal(options.idempotencyKey, 'format-test');
});

test('admin email preserves heading alignment, quotations, strikethrough and inline code', async () => {
  env.RESEND_API_KEY = SENSITIVE[2];
  captureLogs();
  const post = mock.method(Resend.prototype, 'post', async () => ({ data: { id: 'test-id' }, error: null }));
  const { sendAdminEmail } = require('../dist/services/emailService');
  const html = '<h2 style="text-align: center; color: red">Title</h2><h3>Section</h3><blockquote><p style="text-align: right"><s>Old</s> <code>New</code></p></blockquote><p style="text-align: justify">End</p>';
  await sendAdminEmail(SENSITIVE[0], 'Update', 'Title\nSection\nOld New\nEnd', 'style-test', html);
  const [, message] = post.mock.calls[0].arguments;
  assert.equal(message.html, '<h2 style="text-align:center">Title</h2><h3>Section</h3><blockquote><p style="text-align:right"><s>Old</s> <code>New</code></p></blockquote><p>End</p>');
});

test('admin mail embeds uploaded image bytes and removes externally supplied image tags', async () => {
  env.RESEND_API_KEY = SENSITIVE[2];
  captureLogs();
  const post = mock.method(Resend.prototype, 'post', async () => ({ data: { id: 'test-id' }, error: null }));
  const { sendAdminEmail } = require('../dist/services/emailService');
  const content = Buffer.from('89504e470d0a1a0a', 'hex');
  await sendAdminEmail(SENSITIVE[0], 'Photo', '', 'image-test', '<img src="https://example.test/pixel">',
    { content, contentType: 'image/png', filename: 'image.png' });
  const [, message, options] = post.mock.calls[0].arguments;
  const [attachment] = message.attachments;
  assert.equal(attachment.content, content.toString('base64'));
  assert.equal(attachment.content_type, 'image/png');
  assert.ok(message.html.includes('src="cid:' + attachment.content_id + '"'));
  assert.ok(!message.html.includes('example.test'));
  assert.equal(message.text, 'Image attached.');
  assert.equal(options.idempotencyKey, 'image-test');
});
