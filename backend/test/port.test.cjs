const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveServerPort } = require('../dist/config/port');

test('local development defaults to port 3000 when PORT is missing or blank', () => {
  for (const value of [undefined, '', '  ']) {
    assert.equal(resolveServerPort(value, 'development'), 3000);
    assert.equal(resolveServerPort(value, 'test'), 3000);
  }
});

test('production requires an explicit port with an actionable error', () => {
  for (const value of [undefined, '', '  ']) {
    assert.throws(() => resolveServerPort(value, 'production'), /PORT is not defined in production.*PORT=3000/);
  }
});

test('configured local and Railway ports are honored', () => {
  for (const nodeEnv of ['development', 'production']) {
    for (const value of ['1', '3000', '8080', '65535', ' 4000 ']) {
      assert.equal(resolveServerPort(value, nodeEnv), Number(value));
    }
  }
});

test('invalid ports fail before listening without echoing the configured value', () => {
  for (const value of ['0', '-1', '65536', '3000junk', '3.5', 'NaN', 'Infinity', '1e3', '0xBB8', 'secret-value']) {
    assert.throws(() => resolveServerPort(value, 'production'), {
      message: 'PORT must be an integer between 1 and 65535.',
    });
  }
});
