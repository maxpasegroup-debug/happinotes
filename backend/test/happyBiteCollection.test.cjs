const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { Types } = require('mongoose');
const { User, Content, HappyBite } = require('../dist/models');
const deletion = require('../dist/services/accountDeletion');
const { ForbiddenError } = require('../dist/utils/errors');
const controller = require('../dist/controllers/collectionController');
const router = require('../dist/routes/collectionRoutes').default;
const { authenticate } = require('../dist/middleware');
const userId = new Types.ObjectId(), biteId = new Types.ObjectId();
const request = (overrides = {}) => ({ user: { _id: userId, role: 'user', purchasedBooks: [] }, params: { biteId: String(biteId) }, ...overrides });
const response = () => ({ headers: {}, setHeader(k, v) { this.headers[k] = v; }, vary(v) { this.headers.Vary = v; }, statusCode: 200, status(code) { this.statusCode = code; return this; }, json(payload) { this.payload = payload; return this; } });
const next = error => { throw error; };
afterEach(() => mock.restoreAll());

test('Happy Bite collection routes use the existing authentication middleware', () => {
  assert.equal(router.stack[0].handle, authenticate);
  for (const method of ['post', 'delete']) assert.ok(router.stack.some(layer => layer.route?.path === '/happy-bites/:biteId' && layer.route.methods[method]));
});

test('new and legacy users have a separate Happy Bite collection', () => {
  const user = new User({ name: 'Listener', password: 'hashed' });
  assert.equal(user.happyBiteCollection.length, 0);
  assert.equal(User.schema.path('happyBiteCollection').caster.options.ref, 'HappyBite');
  assert.equal(User.schema.path('bookCollection').caster.options.ref, 'Content');
});

test('save uses the authenticated user, verifies publication, and atomically deduplicates without changing books', async () => {
  mock.method(deletion, 'assertAccountWritable', async () => {});
  const stored = new Set();
  mock.method(HappyBite, 'findOne', filter => {
    assert.deepEqual(filter, { _id: String(biteId), published: true });
    return { select: () => Promise.resolve({ _id: biteId }) };
  });
  const content = mock.method(Content, 'findById', () => { throw new Error('Must not query audiobooks'); });
  mock.method(User, 'updateOne', async (filter, update) => {
    assert.equal(filter._id, userId);
    assert.equal(filter.blocked.$ne, true);
    assert.deepEqual(filter.deletionState.$nin, ['pending', 'completed']);
    assert.deepEqual(Object.keys(update), ['$addToSet']);
    assert.deepEqual(Object.keys(update.$addToSet), ['happyBiteCollection']);
    stored.add(String(update.$addToSet.happyBiteCollection));
    return { matchedCount: 1 };
  });
  for (let i = 0; i < 2; i++) {
    const res = response();
    await controller.addHappyBiteToCollection(request({ body: { userId: 'someone-else' } }), res, next);
    assert.equal(res.statusCode, 201);
  }
  assert.equal(stored.size, 1);
  assert.equal(content.mock.callCount(), 0);
});

test('invalid synthetic IDs fail with a clear 400 before reaching MongoDB', async () => {
  mock.method(deletion, 'assertAccountWritable', async () => {});
  const content = mock.method(Content, 'findById', () => { throw new Error('Unexpected database lookup'); });
  for (const [handler, params] of [
    [controller.addToCollection, { bookId: `happy-bite-${biteId}` }],
    [controller.addHappyBiteToCollection, { biteId: 'not-an-id' }],
    [controller.removeHappyBiteFromCollection, { biteId: 'not-an-id' }],
  ]) {
    let error;
    await handler(request({ params }), response(), value => { error = value; });
    assert.equal(error.statusCode, 400);
  }
  assert.equal(content.mock.callCount(), 0);
});

test('draft or deleted bites cannot be saved and blocked accounts cannot mutate bookmarks', async () => {
  mock.method(deletion, 'assertAccountWritable', async () => {});
  mock.method(HappyBite, 'findOne', () => ({ select: async () => null }));
  const writes = mock.method(User, 'updateOne', async () => { throw new Error('Must not write'); });
  let error;
  await controller.addHappyBiteToCollection(request(), response(), value => { error = value; });
  assert.equal(error.statusCode, 404);
  await controller.addHappyBiteToCollection(request({ user: undefined }), response(), value => { error = value; });
  assert.equal(error.statusCode, 403);
  mock.method(deletion, 'assertAccountWritable', async () => { throw new ForbiddenError('Account deletion is in progress'); });
  await controller.removeHappyBiteFromCollection(request(), response(), value => { error = value; });
  assert.equal(error.statusCode, 403);
  assert.equal(writes.mock.callCount(), 0);
});

test('removing a deleted bite is idempotent and only pulls from the Happy Bite collection', async () => {
  mock.method(deletion, 'assertAccountWritable', async () => {});
  const content = mock.method(HappyBite, 'findOne', () => { throw new Error('Removal must work after deletion'); });
  mock.method(User, 'updateOne', async (filter, update) => {
    assert.equal(filter._id, userId);
    assert.deepEqual(update, { $pull: { happyBiteCollection: String(biteId) } });
    return { matchedCount: 1, modifiedCount: 0 };
  });
  const res = response();
  await controller.removeHappyBiteFromCollection(request(), res, next);
  assert.equal(res.payload.success, true);
  assert.equal(content.mock.callCount(), 0);
});

test('library preserves audiobooks, hides unavailable bites, and applies existing Pro audio gating', async () => {
  mock.method(deletion, 'assertAccountWritable', async () => {});
  const free = { _id: 'free', published: true, accessType: 'free', audioUrl: '/free.mp3' };
  const premium = { _id: 'premium', published: true, accessType: 'premium', audioUrl: '/premium.mp3' };
  const liveBook = { _id: 'book', status: 'live' };
  const populated = [];
  mock.method(User, 'findById', () => ({
    populate(value) { populated.push(value); return this; }, select() { return this; },
    lean: async () => ({ bookCollection: [liveBook, { status: 'draft' }, null], happyBiteCollection: [free, premium, { published: false }, null] }),
  }));
  for (const [subscription, canPlay] of [[undefined, false], [{ active: true, expiresAt: new Date(Date.now() - 1000) }, false], [{ active: true, expiresAt: new Date(Date.now() + 60000) }, true]]) {
    const res = response();
    await controller.getCollection(request({ user: { _id: userId, role: 'user', subscription } }), res, next);
    assert.deepEqual(res.payload.collection, [liveBook]);
    assert.equal(res.payload.happyBites.length, 2);
    assert.equal(res.payload.happyBites[0].audioUrl, '/free.mp3');
    assert.equal(res.payload.happyBites[1].audioUrl, canPlay ? '/premium.mp3' : undefined);
    assert.equal(res.payload.happyBites[1].locked, !canPlay);
    assert.equal(res.headers['Cache-Control'], 'private, no-store');
  }
  assert.ok(populated.some(value => value?.path === 'happyBiteCollection' && value.match.published));
});

test('audiobook purchase restrictions remain in effect', async () => {
  mock.method(deletion, 'assertAccountWritable', async () => {});
  mock.method(Content, 'findById', async () => ({ _id: biteId, status: 'live', type: 'premium', priceInr: 10 }));
  let error;
  await controller.addToCollection(request({ params: { bookId: String(biteId) } }), response(), value => { error = value; });
  assert.equal(error.statusCode, 403);
  assert.match(error.message, /Purchase this story/);
});
