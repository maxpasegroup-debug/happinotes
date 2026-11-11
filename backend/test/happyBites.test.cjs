const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { HappyBite } = require('../dist/models');
const controller = require('../dist/controllers/happyBitesController');

afterEach(() => mock.restoreAll());

function response() {
  return { statusCode: 200, payload: undefined, status(code) { this.statusCode = code; return this; }, json(value) { this.payload = value; return this; } };
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
