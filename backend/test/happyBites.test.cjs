const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { HappyBite } = require('../dist/models');
const controller = require('../dist/controllers/happyBitesController');
const realtime = require('../dist/services/realtime');

afterEach(() => { mock.restoreAll(); realtime.registerRealtimeServer(null); });

function response() {
  return { headers: {}, setHeader(key, value) { this.headers[key] = value; }, vary(value) { this.headers.Vary = value; }, statusCode: 200, payload: undefined, status(code) { this.statusCode = code; return this; }, json(value) { this.payload = value; return this; } };
}

test('successful Happy Bite create, edit, publish/unpublish and delete broadcast invalidation only', async () => {
  const events = [];
  realtime.registerRealtimeServer({ emit: (...args) => events.push(args) });
  const body = { title: 'Draft title', description: 'Private description', thumbnailUrl: '/cover.jpg', audioUrl: '/premium.mp3', category: 'Joy' };
  mock.method(HappyBite, 'create', async value => ({ ...value, _id: 'b1' }));
  mock.method(HappyBite, 'findByIdAndUpdate', async (_id, value) => ({ _id: 'b1', ...value.$set }));
  mock.method(HappyBite, 'findByIdAndDelete', async () => ({ _id: 'b1' }));
  const next = error => { throw error; };
  await controller.createHappyBite({ body }, response(), next);
  for (const update of [{ title: 'Edited', audioUrl: '/replacement.mp3' }, { published: true }, { published: false }, { accessType: 'premium', displayOrder: 2 }]) {
    await controller.updateHappyBite({ params: { id: 'b1' }, body: update }, response(), next);
  }
  await controller.deleteHappyBite({ params: { id: 'b1' } }, response(), next);
  assert.equal(events.length, 6);
  for (const [name, payload] of events) {
    assert.equal(name, 'happy-bites:changed');
    assert.deepEqual(Object.keys(payload), ['occurredAt']);
    assert.ok(Number.isFinite(Date.parse(payload.occurredAt)));
  }
});

test('Happy Bite change events wait for persistence and are not sent on failed saves', async () => {
  const events = [];
  realtime.registerRealtimeServer({ emit: (...args) => events.push(args) });
  let save;
  mock.method(HappyBite, 'create', () => new Promise(resolve => { save = resolve; }));
  const body = { title: 'Title', description: 'Description', thumbnailUrl: '/cover.jpg', audioUrl: '/clip.mp3', category: 'Joy' };
  const pending = controller.createHappyBite({ body }, response(), error => { throw error; });
  assert.equal(events.length, 0);
  save({ _id: 'b1', ...body });
  await pending;
  assert.equal(events.length, 1);
  events.length = 0;
  mock.method(HappyBite, 'create', async () => { throw new Error('Database unavailable'); });
  mock.method(HappyBite, 'findByIdAndUpdate', async () => null);
  mock.method(HappyBite, 'findByIdAndDelete', async () => null);
  const errors = [];
  await controller.createHappyBite({ body }, response(), error => errors.push(error));
  await controller.createHappyBite({ body: {} }, response(), error => errors.push(error));
  await controller.updateHappyBite({ params: { id: 'missing' }, body: { published: false } }, response(), error => errors.push(error));
  await controller.deleteHappyBite({ params: { id: 'missing' } }, response(), error => errors.push(error));
  assert.equal(errors.length, 4);
  assert.equal(events.length, 0);
});

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


test('Happy Bite language persists through create, update and admin/public serialization', async () => {
  const base = { title: 'Thought', description: 'Description', thumbnailUrl: '/t.jpg', audioUrl: '/a.mp3', category: 'Joy' };
  let stored;
  mock.method(HappyBite, 'create', async (value) => {
    const document = new HappyBite(value);
    assert.equal(document.validateSync(), undefined);
    stored = document.toObject();
    return stored;
  });
  const res = response();
  const next = (error) => { throw error; };
  await controller.createHappyBite({ body: { ...base, language: '  മലയാളം  ' } }, res, next);
  assert.equal(res.payload.happyBite.language, 'മലയാളം');
  mock.method(HappyBite, 'findByIdAndUpdate', async (_id, update, options) => {
    assert.equal(options.runValidators, true);
    stored = { ...stored, ...update.$set };
    return stored;
  });
  for (const language of ['Zulu', 'Valley dialect', 'Oriya']) {
    await controller.updateHappyBite({ params: { id }, body: { language } }, res, next);
    assert.equal(res.payload.happyBite.language, language);
  }
  await controller.updateHappyBite({ params: { id }, body: { published: true } }, res, next);
  assert.equal(stored.language, 'Oriya');
  mock.method(HappyBite, 'find', () => ({ sort() { return this; }, lean: async () => [stored, { ...base }] }));
  await controller.listAdminHappyBites({}, res, next);
  assert.equal(res.payload.happyBites[0].language, 'Oriya');
  assert.equal(res.payload.happyBites[1].language, undefined);
  assert.equal(controller.publicBite(stored, false).language, 'Oriya');
  assert.equal(controller.publicBite({ ...stored, accessType: 'premium' }, false).audioUrl, undefined);
});

test('Happy Bite language rejects malformed values but older clients may omit it', async () => {
  const base = { title: 'Thought', description: 'Description', thumbnailUrl: '/t.jpg', audioUrl: '/a.mp3', category: 'Joy' };
  const create = mock.method(HappyBite, 'create', async (value) => value);
  const update = mock.method(HappyBite, 'findByIdAndUpdate', async () => assert.fail('must not update'));
  for (const language of ['', '   ', null, 123, [], {}, 'a'.repeat(161)]) {
    for (const action of ['create', 'update']) {
      let error;
      if (action === 'create') await controller.createHappyBite({ body: { ...base, language } }, response(), e => { error = e; });
      else await controller.updateHappyBite({ params: { id }, body: { language } }, response(), e => { error = e; });
      assert.equal(error?.statusCode, 400);
      assert.match(error.message, /language/);
    }
  }
  assert.equal(create.mock.callCount(), 0);
  assert.equal(update.mock.callCount(), 0);
  const res = response();
  await controller.createHappyBite({ body: base }, res, e => { throw e; });
  assert.equal(res.payload.happyBite.language, undefined);
  assert.equal(new HappyBite(base).language, undefined);
  assert.ok(new HappyBite({ ...base, language: 'a'.repeat(161) }).validateSync().errors.language);
});

test('language and category filtering happens before pagination and escapes regex syntax', async () => {
  let filter;
  const records = [
    { _id: 'other', language: 'English', category: 'Joy', published: true },
    ...Array.from({ length: 21 }, (_, i) => ({ _id: String(i), language: 'Malayalam', category: 'Joy', published: true })),
    { _id: 'draft', language: 'Malayalam', category: 'Joy', published: false },
  ];
  const matching = value => records.filter(item => item.published && item.category === value.category && value.language.$in.some(pattern => pattern.test(item.language)));
  mock.method(HappyBite, 'find', value => {
    filter = value; let offset = 0, size = 20;
    return { sort() { return this; }, skip(n) { offset = n; return this; }, limit(n) { size = n; return this; }, lean: async () => matching(value).slice(offset, offset + size) };
  });
  mock.method(HappyBite, 'countDocuments', async value => matching(value).length);
  mock.method(HappyBite, 'distinct', async key => key === 'language' ? ['English', 'Malayalam', 'Valley dialect'] : ['Joy']);
  const res = response();
  await controller.listHappyBites({ query: { language: 'malayalam', languageAlias: ['mal', 'മലയാളം'], category: 'Joy', page: '2', limit: '20' } }, res, e => { throw e; });
  assert.equal(res.payload.happyBites.length, 1);
  assert.equal(res.payload.pagination.total, 21);
  assert.equal(res.payload.pagination.hasMore, false);
  assert.equal(filter.published, true);
  assert.ok(res.payload.languages.includes('Valley dialect'));
  assert.equal(res.payload.capabilities.languageFiltering, true);
  await controller.listHappyBites({ query: { language: 'A.*', category: 'Joy' } }, res, e => { throw e; });
  assert.equal(filter.language.$in[0].test('A.*'), true);
  assert.equal(filter.language.$in[0].test('Arabic'), false);
});

test('listening preferences accept international/custom names and reject malformed input', async () => {
  const { User } = require('../dist/models');
  const auth = require('../dist/controllers/authController');
  mock.method(require('../dist/services/accountDeletion'), 'assertAccountWritable', async () => {});
  let saved = 0;
  const user = { _id: id, languagePreference: 'all', save: async () => { saved++; } };
  for (const languagePreference of ['  Japanese  ', 'Valley dialect', 'മലയാളം', 'all']) {
    await auth.updateLanguage({ user, body: { languagePreference } }, response(), e => { throw e; });
    assert.equal(user.languagePreference, languagePreference.trim().toLowerCase());
  }
  assert.equal(saved, 4);
  for (const languagePreference of ['', '  ', null, [], {}, 'a'.repeat(161)]) {
    let error;
    await auth.updateLanguage({ user, body: { languagePreference } }, response(), e => { error = e; });
    assert.equal(error?.statusCode, 400);
  }
  assert.equal(saved, 4);
  const doc = new User({ languagePreference: 'japanese' });
  assert.equal(doc.validateSync()?.errors.languagePreference, undefined);
});

test('Happy Bites JSON saves match the revision and allow only editable data to be written', async () => {
  const revision = '2026-10-01T10:30:00.000Z';
  const events = [];
  realtime.registerRealtimeServer({ emit: (...args) => events.push(args) });
  let matches = true;
  const write = mock.method(HappyBite, 'findOneAndUpdate', async (filter, update, options) => {
    assert.deepEqual(filter, { _id: 'bite1', updatedAt: new Date(revision) });
    assert.deepEqual(update, { $set: { category: 'Joy' } });
    assert.equal(options.runValidators, true);
    return matches ? { _id: 'bite1', category: 'Joy' } : null;
  });
  const req = { params: { id: 'bite1' }, body: { category: 'Joy', expectedUpdatedAt: revision, _id: 'other', updatedAt: 'other', __v: 8 } };
  const res = response();
  await controller.updateHappyBite(req, res, e => { throw e; });
  assert.equal(res.payload.happyBite.category, 'Joy');
  matches = false;
  let error;
  await controller.updateHappyBite(req, response(), e => { error = e; });
  assert.equal(error.statusCode, 409);
  req.body.expectedUpdatedAt = 'invalid';
  await controller.updateHappyBite(req, response(), e => { error = e; });
  assert.equal(error.statusCode, 400);
  assert.equal(write.mock.calls.length, 2);
  assert.equal(events.length, 1);
});
