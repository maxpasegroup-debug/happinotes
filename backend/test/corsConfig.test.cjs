const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildCorsConfiguration } = require('../dist/config/cors');

const adminOrigin = 'https://happinotes.online';

test('production requires a non-empty allowlist containing the confirmed admin origin', () => {
  assert.throws(() => buildCorsConfiguration('production', undefined), /CORS_ORIGINS is required/);
  assert.throws(() => buildCorsConfiguration('production', ''), /CORS_ORIGINS is required/);
  assert.throws(() => buildCorsConfiguration('production', 'https://other.example.com'), /must include the required production origin/);
});

test('production shares only the validated exact allowlist between HTTP and Socket.IO', () => {
  const config = buildCorsConfiguration('production', `${adminOrigin},https://reader.example.com`);
  assert.deepEqual(config.allowedOrigins, [adminOrigin, 'https://reader.example.com']);
  assert.equal(config.socketIoOptions.origin, config.allowedOrigins);

  let allowed;
  config.httpOptions.origin(adminOrigin, (error, result) => {
    assert.equal(error, null);
    allowed = result;
  });
  assert.equal(allowed, true);

  let deniedError;
  config.httpOptions.origin('https://unlisted.example.com', (error) => { deniedError = error; });
  assert.equal(deniedError.message, 'Not allowed by CORS');
  assert.ok(!config.allowedOrigins.includes('https://arbitrary.vercel.app'));
  assert.ok(!config.allowedOrigins.includes('https://arbitrary.railway.app'));
});

test('production allowlist rejects paths, credentials, malformed origins, and insecure origins', () => {
  for (const origin of [
    'https://happinotes.online/admin',
    'https://name:password@example.com',
    'http://happinotes.online',
    'https://happinotes.online?mode=admin',
  ]) {
    assert.throws(
      () => buildCorsConfiguration('production', `${adminOrigin},${origin}`),
      /canonical origins|canonical browser origins/,
    );
  }
});

test('development preserves local browser origins while production excludes them by default', () => {
  const development = buildCorsConfiguration('development', undefined);
  assert.deepEqual(development.allowedOrigins, [
    'http://localhost:8081',
    'http://localhost:3000',
    'http://localhost:3001',
  ]);

  let originlessAllowed;
  development.httpOptions.origin(undefined, (error, result) => {
    assert.equal(error, null);
    originlessAllowed = result;
  });
  assert.equal(originlessAllowed, true);

  const production = buildCorsConfiguration('production', adminOrigin);
  assert.deepEqual(production.allowedOrigins, [adminOrigin]);
  assert.ok(!production.allowedOrigins.includes('http://localhost:3000'));
});
