const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const metrics = require('../dist/services/systemMetrics');
const railway = require('../dist/services/railwayStatus');
const express = require('express');
const jwt = require('jsonwebtoken');
const { User } = require('../dist/models/User');
const { env } = require('../dist/config/env');
const { errorHandler } = require('../dist/middleware/errorHandler');
afterEach(() => mock.restoreAll());
let tokenId = 0;
function useToken(t) {
  const previous = process.env.RAILWAY_TOKEN;
  process.env.RAILWAY_TOKEN = `test-project-token-${++tokenId}`;
  t.after(() => { if (previous === undefined) delete process.env.RAILWAY_TOKEN; else process.env.RAILWAY_TOKEN = previous; });
}
const deployment = { id: 'test-deployment', status: 'BUILDING', createdAt: new Date().toISOString() };
test('bounded metrics exclude monitoring requests and retain no request paths', async () => {
  assert.equal(metrics.percentile([], .95), null); assert.equal(metrics.percentile([5, 2, 9], .95), 9);
  const res = new EventEmitter(); res.statusCode = 503;
  metrics.recordSystemRequest({ path: '/private/secret-id' }, res, () => {}); res.emit('finish');
  const ignored = new EventEmitter(); ignored.statusCode = 200;
  metrics.recordSystemRequest({ path: '/api/admin/system-status' }, ignored, () => {}); ignored.emit('finish');
  await metrics.collectSystemSample();
  const snapshot = metrics.systemSnapshot(), sample = snapshot.samples.at(-1);
  assert.equal(sample.requests, 1); assert.equal(sample.errors5xx, 1); assert.equal(sample.errorRate, 100);
  assert.equal(sample.mongoConnected, false); assert.equal(sample.mongoPingMs, null);
  assert.ok(sample.rssMiB > 0); assert.equal(JSON.stringify(snapshot).includes('secret-id'), false);
  for (let i = 0; i < 725; i++) await metrics.collectSystemSample();
  assert.equal(metrics.systemSnapshot().samples.length, 720);
});
test('Mongo statistics are allowlisted; missing measurements stay null', () => {
  const result = metrics.sanitizeMongoStats({ host: 'private host', connections: { current: 7 }, opcounters: { insert: 10, query: 20 }, mem: { resident: 25 }, uptime: 100 }, { dataSize: 1000, objects: 4, db: 'private db' });
  assert.equal(result.connections, 7); assert.equal(result.operations, 30); assert.equal(result.dataBytes, 1000);
  assert.equal(result.availableConnections, null); assert.equal(JSON.stringify(result).includes('private'), false);
  assert.equal(metrics.sanitizeMongoStats(null, null).databaseStatsAvailable, false);
});
test('no token yields setup state without provider requests', async t => {
  const previous = process.env.RAILWAY_TOKEN; delete process.env.RAILWAY_TOKEN;
  t.after(() => { if (previous !== undefined) process.env.RAILWAY_TOKEN = previous; });
  mock.method(global, 'fetch', () => { throw Error('must not fetch'); });
  assert.equal((await railway.railwayDeployments()).configured, false);
});
test('project-scoped read-only Railway calls are deduplicated; other deployment IDs are rejected', async t => {
  useToken(t); const calls = [];
  mock.method(global, 'fetch', async (url, options) => {
    calls.push(JSON.parse(options.body)); assert.equal(url, 'https://backboard.railway.com/graphql/v2');
    assert.equal(options.headers.Authorization, undefined); assert.equal(options.headers['Project-Access-Token'], process.env.RAILWAY_TOKEN);
    assert.equal(calls.at(-1).query.includes('mutation'), false);
    return Response.json({ data: { deployments: { edges: [{ node: deployment }] } } });
  });
  const [a, b] = await Promise.all([railway.railwayDeployments(), railway.railwayDeployments()]);
  assert.deepEqual(a.deployments, b.deployments); assert.equal(calls.length, 1);
  assert.equal(calls[0].variables.input.serviceId, 'bedf0ec2-e8a7-464d-bf9e-fcacfada0769');
  await assert.rejects(railway.railwayLogs('someone-elses-deployment', 'build'), /recent deployment list/); assert.equal(calls.length, 1);
});
test('logs are redacted; metrics preserve provider values', async t => {
  useToken(t);
  mock.method(global, 'fetch', async (_url, options) => {
    const request = JSON.parse(options.body);
    if (request.query.includes('StatusDeployments')) return Response.json({ data: { deployments: { edges: [{ node: deployment }] } } });
    if (request.query.includes('StatusLogs')) return Response.json({ data: { buildLogs: [{ timestamp: '2026-11-16T00:00:00Z', message: `RAILWAY_TOKEN=${process.env.RAILWAY_TOKEN} mongodb://name:password@private/database`, severity: 'error' }] } });
    assert.deepEqual(request.variables.measurements, ['CPU_USAGE', 'MEMORY_USAGE_GB', 'DISK_USAGE_GB', 'NETWORK_RX_GB', 'NETWORK_TX_GB']);
    return Response.json({ data: { metrics: [{ measurement: 'CPU_USAGE', values: [{ ts: 1794787200, value: .25 }] }] } });
  });
  const result = await railway.railwayLogs(deployment.id, 'build');
  assert.equal(result.logs.length, 1); assert.equal(JSON.stringify(result).includes(process.env.RAILWAY_TOKEN), false);
  assert.equal(JSON.stringify(result).includes('mongodb://'), false);
  assert.equal(JSON.stringify(result).includes('RAILWAY_TOKEN'), false);
  assert.equal((await railway.railwayMetrics()).metrics[0].values[0].value, .25);
});
test('Railway errors do not leak raw responses and are briefly cached', async t => {
  useToken(t); let count = 0;
  mock.method(global, 'fetch', async () => { count++; return Response.json({ errors: [{ message: 'private provider details' }] }); });
  for (let i = 0; i < 2; i++) await assert.rejects(railway.railwayDeployments(), error => !error.message.includes('private provider details'));
  assert.equal(count, 1);
});
test('logs strip known secrets, key blocks, addresses and terminal escapes', t => {
  useToken(t);
  const text = railway.redactSystemLog(`Build ok\u001b[31m API_KEY="secret-value" Bearer secret-value https://host/private ${process.env.RAILWAY_TOKEN}\n-----BEGIN PRIVATE KEY-----\nSECRET KEY DATA\n-----END PRIVATE KEY-----`);
  for (const secret of ['secret-value', 'host/private', 'SECRET KEY DATA', process.env.RAILWAY_TOKEN, '\u001b']) assert.equal(text.includes(secret), false);
  assert.ok(text.includes('Build ok')); assert.ok(railway.redactSystemLog('x'.repeat(10000)).length <= 4000);
});
test('HTTP endpoints deny guests and non-admins', async t => {
  mock.method(require('../dist/models/AccountDeletionRequest').AccountDeletionRequest, 'exists', async () => null);
  mock.method(User, 'findById', async () => ({ _id: '64b000000000000000000002', role: 'user', sessionVersion: 0, blocked: false }));
  const app = express(); app.use('/admin/system-status', require('../dist/routes/systemStatusRoutes').default); app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}/admin/system-status`;
  const token = jwt.sign({ id: '64b000000000000000000002' }, env.JWT_SECRET, { algorithm: 'HS256' });
  for (const endpoint of ['', '/deployments', '/logs?deploymentId=test&kind=build', '/infrastructure']) {
    assert.equal((await fetch(base + endpoint)).status, 401);
    assert.equal((await fetch(base + endpoint, { headers: { Authorization: `Bearer ${token}` } })).status, 403);
  }
});

test('Mongo ping can stay healthy when performance commands are not permitted', async t => {
  const connection = require('mongoose').connection;
  const descriptor = Object.getOwnPropertyDescriptor(connection, 'readyState');
  const originalDb = connection.db;
  Object.defineProperty(connection, 'readyState', { configurable: true, value: 1 });
  connection.db = { command: async (command, options) => { assert.equal(options.timeoutMS, 2000); if (command.ping) return { ok: 1 }; throw Error('not authorized'); }, admin: () => ({ command: async () => { throw Error('not authorized'); } }) };
  t.after(() => { if (descriptor) Object.defineProperty(connection, 'readyState', descriptor); else delete connection.readyState; connection.db = originalDb; });
  await metrics.collectSystemSample();
  const snapshot = metrics.systemSnapshot();
  assert.equal(snapshot.samples.at(-1).mongoConnected, true); assert.equal(snapshot.mongo.serverStatsAvailable, false);
  assert.equal(snapshot.mongo.dataBytes, null); assert.ok(snapshot.samples.at(-1).mongoPingMs >= 0);
});
