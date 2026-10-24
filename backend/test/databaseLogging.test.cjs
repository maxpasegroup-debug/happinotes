const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { connectDB } = require('../dist/config/database');

const originalMongoUri = process.env.MONGODB_URI;

afterEach(() => {
  mock.restoreAll();
  if (originalMongoUri === undefined) delete process.env.MONGODB_URI;
  else process.env.MONGODB_URI = originalMongoUri;
});

test('connection success logs only a generic start message and the parsed host', async () => {
  const uri = 'mongodb://db-user:sentinel-password@db.example.test:27017/happi?replicaSet=sentinel-option';
  const output = [];
  process.env.MONGODB_URI = uri;
  mock.method(console, 'log', (...args) => output.push(args.join(' ')));
  mock.method(mongoose, 'connect', async () => ({ connection: { host: 'db.example.test' } }));

  await connectDB();

  assert.deepEqual(output, ['Connecting to MongoDB', 'MongoDB connected: db.example.test']);
  assert.ok(output.join('\n').includes('db.example.test'));
  assert.ok(!output.join('\n').includes(uri));
  assert.ok(!output.join('\n').includes('db-user'));
  assert.ok(!output.join('\n').includes('sentinel-password'));
  assert.ok(!output.join('\n').includes('sentinel-option'));
});

test('connection failure does not log the URI or any nested error details', async () => {
  const uri = 'mongodb://db-user:sentinel-password@db.example.test:27017/happi?replicaSet=sentinel-option';
  const output = [];
  let exitCode;
  const error = new Error(`failed to connect using ${uri}`);
  error.name = `MongoError ${uri}`;
  error.code = uri;
  error.cause = { message: `nested failure: ${uri}`, password: 'sentinel-password' };
  process.env.MONGODB_URI = uri;
  mock.method(console, 'log', (...args) => output.push(args.join(' ')));
  mock.method(console, 'error', (...args) => output.push(args.join(' ')));
  mock.method(mongoose, 'connect', async () => { throw error; });
  mock.method(process, 'exit', (code) => { exitCode = code; });

  await connectDB();

  assert.equal(exitCode, 1);
  assert.deepEqual(output, ['Connecting to MongoDB', 'MongoDB connection failed']);
  for (const secret of [uri, 'db-user', 'sentinel-password', 'sentinel-option']) {
    assert.ok(!output.join('\n').includes(secret));
  }
});
