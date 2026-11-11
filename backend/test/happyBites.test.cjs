const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { HappyBite } = require('../dist/models');
const controller = require('../dist/controllers/happyBitesController');

afterEach(() => mock.restoreAll());

function response() {
  return { headers: {}, setHeader(key, value) { this.headers[key] = value; }, vary(value) { this.headers.Vary = value; }, statusCode: 200, payload: undefined, status(code) { this.statusCode = code; return this; }, json(value) { this.payload = value; return this; } };
}

test('public Happy Bites listing excludes drafts, filters category, and paginates', async () => {
  let filter;
  let sort;
  let skip;
  let limit;
  const query = {
    sort(value) { sort = value; return this; },
    skip(value) { skip = value; return this; },
    limit(value) { limit = value; return this; },
    lean: async () => [{ _id: 'b1', title: 'One', published: true }],
  };
  mock.method(HappyBite, 'find', (value) => { filter = value; return query; });
  mock.method(HappyBite, 'countDocuments', async () => 21);
  mock.method(HappyBite, 'distinct', async () => ['mindfulness', 'health']);
  const res = response();
  await controller.listHappyBites({ query: { page: '2', limit: '10', category: 'mindfulness' } }, res, (error) => { throw error; });
  assert.deepEqual(filter, { published: true, category: 'mindfulness' });
  assert.deepEqual(sort, { displayOrder: 1, createdAt: -1, _id: -1 });
  assert.equal(skip, 10);
  assert.equal(limit, 10);
  assert.equal(res.payload.pagination.hasMore, true);
  assert.deepEqual(res.payload.categories, ['health', 'mindfulness']);
});

test('admin create requires the Happy Bite fields and defaults it to a draft', async () => {
  let saved;
  mock.method(HappyBite, 'create', async (value) => { saved = value; return { ...value, _id: 'bite-id' }; });
  const res = response();
  await controller.createHappyBite({ body: { title: 'A thought', description: 'A description', thumbnailUrl: 'https://media.test/t.jpg', audioUrl: 'https://media.test/a.mp3', durationSeconds: 52, category: 'mindfulness', displayOrder: 4 } }, res, (error) => { throw error; });
  assert.equal(res.statusCode, 201);
  assert.equal(saved.published, false);
  assert.equal(saved.accessType, 'free');
  assert.equal(saved.durationSeconds, 52);
  assert.equal(res.payload.happyBite._id, 'bite-id');
});

test('admin cannot create a Happy Bite without audio', async () => {
  const create = mock.method(HappyBite, 'create', async () => { throw new Error('must not save'); });
  const res = response();
  let error;
  await controller.createHappyBite({ body: { title: 'A thought', description: 'A description', thumbnailUrl: 'https://media.test/t.jpg', category: 'mindfulness' } }, res, (value) => { error = value; });
  assert.equal(create.mock.callCount(), 0);
  assert.equal(error.statusCode, 400);
  assert.match(error.message, /audioUrl/);
});

test('admin can unpublish a Happy Bite without touching payment or book fields', async () => {
  let update;
  mock.method(HappyBite, 'findByIdAndUpdate', async (_id, value) => { update = value; return { _id: 'b1', published: false }; });
  const res = response();
  await controller.updateHappyBite({ params: { id: 'b1' }, body: { published: false } }, res, (error) => { throw error; });
  assert.deepEqual(update, { $set: { published: false } });
  assert.equal(res.payload.happyBite.published, false);
});

const id = '64b000000000000000000001';
const premium = { _id: id, title: 'Premium thought', published: true, accessType: 'premium', audioUrl: 'https://media.test/premium.mp3' };
const users = [
  ['guest', undefined, false],
  ['free user', { role: 'user' }, false],
  ['book purchaser', { role: 'user', purchasedBookIds: [id] }, false],
  ['inactive Pro', { role: 'user', subscription: { active: false, expiresAt: new Date('2999-01-01') } }, false],
  ['expired Pro', { role: 'user', subscription: { active: true, expiresAt: new Date('2000-01-01') } }, false],
  ['active Pro', { role: 'user', subscription: { active: true, expiresAt: new Date('2999-01-01') } }, true],
  ['existing indefinite entitlement', { role: 'user', subscription: { active: true } }, true],
  ['admin', { role: 'admin' }, true],
];
for (const [name, user, allowed] of users) {
  test(`Happy Bites list and detail enforce existing Pro access for ${name}`, async () => {
    const legacy = { _id: 'legacy', audioUrl: 'https://media.test/legacy.mp3' };
    const free = { _id: 'free', accessType: 'free', audioUrl: 'https://media.test/free.mp3' };
    const query = { sort() { return this; }, skip() { return this; }, limit() { return this; }, lean: async () => [premium, free, legacy] };
    mock.method(HappyBite, 'find', () => query);
    mock.method(HappyBite, 'countDocuments', async () => 3);
    mock.method(HappyBite, 'distinct', async () => []);
    mock.method(HappyBite, 'findOne', (filter) => {
      assert.deepEqual(filter, { _id: id, published: true });
      return { lean: async () => premium };
    });
    const listing = response();
    await controller.listHappyBites({ query: {}, user }, listing, (e) => { throw e; });
    const detail = response();
    await controller.getHappyBite({ params: { id }, user }, detail, (e) => { throw e; });
    for (const res of [listing, detail]) {
      assert.equal(res.headers['Cache-Control'], 'private, no-store');
      assert.equal(res.headers.Vary, 'Authorization');
    }
    for (const bite of [listing.payload.happyBites[0], detail.payload.happyBite]) {
      assert.equal(bite.locked, !allowed);
      assert.equal(bite.accessType, 'premium');
      assert.equal(Object.hasOwn(bite, 'audioUrl'), allowed);
      if (allowed) assert.equal(bite.audioUrl, premium.audioUrl);
    }
    for (const bite of listing.payload.happyBites.slice(1)) {
      assert.equal(bite.accessType, 'free');
      assert.equal(bite.locked, false);
      assert.ok(bite.audioUrl);
    }
  });
}

test('detail rejects missing, unpublished, and malformed IDs', async () => {
  const lookup = mock.method(HappyBite, 'findOne', (filter) => {
    assert.equal(filter.published, true);
    return { lean: async () => null };
  });
  for (const value of [id, 'malformed']) {
    let error;
    await controller.getHappyBite({ params: { id: value } }, response(), (e) => { error = e; });
    assert.equal(error.statusCode, 404);
  }
  assert.equal(lookup.mock.callCount(), 1);
});

test('admin can create premium content and switch either access direction', async () => {
  const base = { title: 'Premium', description: 'Description', thumbnailUrl: 'https://media.test/t.jpg', audioUrl: premium.audioUrl, category: 'general', accessType: 'premium' };
  mock.method(HappyBite, 'create', async (value) => value);
  const res = response();
  await controller.createHappyBite({ body: base }, res, (e) => { throw e; });
  assert.equal(res.payload.happyBite.accessType, 'premium');
  mock.method(HappyBite, 'findByIdAndUpdate', async (_id, update, options) => {
    assert.equal(options.runValidators, true);
    assert.deepEqual(Object.keys(update.$set), ['accessType']);
    return update.$set;
  });
  for (const accessType of ['free', 'premium']) {
    await controller.updateHappyBite({ params: { id }, body: { accessType } }, res, (e) => { throw e; });
    assert.equal(res.payload.happyBite.accessType, accessType);
  }
});

test('admin rejects invalid access types without persisting them', async () => {
  const update = mock.method(HappyBite, 'findByIdAndUpdate', async () => assert.fail('must not persist'));
  for (const accessType of ['paid', '', null, true, 1]) {
    let error;
    await controller.updateHappyBite({ params: { id }, body: { accessType } }, response(), (e) => { error = e; });
    assert.equal(error.statusCode, 400);
    assert.match(error.message, /accessType/);
  }
  assert.equal(update.mock.callCount(), 0);
});

test('model defaults new content to free and validates the enum', () => {
  const bite = new HappyBite({ title: 'A thought', description: 'Description', thumbnailUrl: '/t.jpg', audioUrl: '/a.mp3', category: 'general' });
  assert.equal(bite.accessType, 'free');
  assert.equal(bite.validateSync(), undefined);
  bite.accessType = 'paid';
  assert.ok(bite.validateSync().errors.accessType);
});

test('both public routes resolve the current authenticated user before shaping audio access', () => {
  const router = require('../dist/routes/happyBiteRoutes').default;
  const { optionalAuthenticate } = require('../dist/middleware');
  for (const path of ['/', '/:id']) {
    const handlers = router.stack.find((layer) => layer.route?.path === path).route.stack;
    assert.equal(handlers[0].handle, optionalAuthenticate);
  }
});

test('admin mutations remain behind authentication and admin authorization', () => {
  const router = require('../dist/routes/adminHappyBiteRoutes').default;
  const { authenticate, requireAdmin } = require('../dist/middleware');
  assert.equal(router.stack[0].handle, authenticate);
  assert.equal(router.stack[1].handle, requireAdmin);
});

test('invalid, revoked, blocked, and deleting accounts do not receive premium audio', async () => {
  const { optionalAuthenticate } = require('../dist/middleware');
  const jwt = require('jsonwebtoken');
  const { User } = require('../dist/models');
  const { AccountDeletionRequest } = require('../dist/models/AccountDeletionRequest');
  let claims;
  let account;
  mock.method(jwt, 'verify', () => { if (!claims) throw new Error('invalid token'); return claims; });
  mock.method(User, 'findById', async () => account);
  mock.method(AccountDeletionRequest, 'exists', async () => false);
  mock.method(HappyBite, 'findOne', () => ({ lean: async () => premium }));
  const pro = { _id: id, role: 'user', subscription: { active: true }, sessionVersion: 1, deletionState: 'active' };
  for (const scenario of [
    { claims: null, account: pro },
    { claims: { id, sessionVersion: 0 }, account: pro },
    { claims: { id, sessionVersion: 1 }, account: { ...pro, blocked: true } },
    { claims: { id, sessionVersion: 1 }, account: { ...pro, deletionState: 'pending' } },
  ]) {
    claims = scenario.claims;
    account = scenario.account;
    const req = { headers: { authorization: 'Bearer test-token' }, params: { id } };
    let continued = false;
    await optionalAuthenticate(req, {}, () => { continued = true; });
    assert.equal(continued, true);
    assert.equal(req.user, undefined);
    const res = response();
    await controller.getHappyBite(req, res, (e) => { throw e; });
    assert.equal(res.payload.happyBite.locked, true);
    assert.equal(Object.hasOwn(res.payload.happyBite, 'audioUrl'), false);
  }
  claims = { id, sessionVersion: 1 };
  account = pro;
  const req = { headers: { authorization: 'Bearer test-token' }, params: { id } };
  await optionalAuthenticate(req, {}, () => {});
  const res = response();
  await controller.getHappyBite(req, res, (e) => { throw e; });
  assert.equal(res.payload.happyBite.audioUrl, premium.audioUrl);
});
