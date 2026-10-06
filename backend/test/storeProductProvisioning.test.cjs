// All database and store calls are mocked. These tests do not make real store API calls.
const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync } = require('node:crypto');
const { GoogleAuth } = require('google-auth-library');
const { StoreProduct } = require('../dist/models/StoreProduct');
const { Content, User } = require('../dist/models');
const service = require('../dist/services/storeProductProvisioning');
const providers = require('../dist/services/storeProductProviders');
const adminRouter = require('../dist/routes/adminStoreProductRoutes').default;
const purchaseRouter = require('../dist/routes/storePurchaseRoutes').default;
const { requireAdmin, authenticate } = require('../dist/middleware');
const { StorePurchase } = require('../dist/models/StorePurchase');
const purchaseService = require('../dist/services/storePurchase');
const bookId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const sku = `happinotes.book.${bookId}`;
const book = { id: bookId, title: 'A story', description: 'A premium story', contentType: 'lifebook', type: 'premium', priceInr: 99, status: 'live' };
const initialEnv = { ...process.env };
afterEach(() => { mock.restoreAll(); process.env = { ...initialEnv }; });

function get(obj, key) { return key.split('.').reduce((o, k) => o?.[k], obj); }
function set(obj, key, value) {
  const keys = key.split('.'); let parent = obj;
  for (const k of keys.slice(0, -1)) parent = parent[k] ||= {};
  parent[keys.at(-1)] = value;
}
function match(row, filter) {
  return Object.entries(filter).every(([key, condition]) => {
    if (key === '$or') return condition.some((f) => match(row, f));
    const value = get(row, key);
    if (condition && typeof condition === 'object' && !(condition instanceof Date)) {
      return Object.entries(condition).every(([op, v]) => {
        if (op === '$exists') return (value !== undefined) === v;
        if (op === '$in') return v.includes(value);
        if (op === '$lte') return value <= v;
        throw Error(`Unsupported mock operator ${op}`);
      });
    }
    return String(value) === String(condition);
  });
}
function database(seed = []) {
  const rows = structuredClone(seed);
  const apply = (row, update, insert = false) => {
    for (const [k, v] of Object.entries({ ...(insert ? update.$setOnInsert : {}), ...update.$set })) set(row, k, v);
    for (const [k, v] of Object.entries(update.$inc || {})) set(row, k, (get(row, k) || 0) + v);
    for (const k of Object.keys(update.$unset || {})) {
      const parts = k.split('.'); const parent = get(row, parts.slice(0, -1).join('.')); if (parent) delete parent[parts.at(-1)];
    }
  };
  process.env.IAP_PRODUCTS_JSON = '{}';
  mock.method(StoreProduct, 'init', async () => {});
  mock.method(StoreProduct, 'findOne', async (filter) => rows.find((r) => match(r, filter)) || null);
  mock.method(StoreProduct, 'updateOne', async (filter, update, options) => {
    let row = rows.find((r) => match(r, filter)); let inserted = false;
    if (!row && options?.upsert) { row = { _id: `row${rows.length}`, bookId: filter.bookId }; rows.push(row); inserted = true; }
    if (!row) return { matchedCount: 0, upsertedCount: 0 };
    apply(row, update, inserted); return { matchedCount: inserted ? 0 : 1, upsertedCount: inserted ? 1 : 0 };
  });
  mock.method(StoreProduct, 'findOneAndUpdate', async (filter, update) => {
    const row = rows.find((r) => match(r, filter)); if (!row) return null;
    apply(row, update); return structuredClone(row);
  });
  mock.method(StoreProduct, 'find', () => ({ lean: async () => structuredClone(rows) }));
  mock.method(Content, 'findById', async () => book);
  return rows;
}
async function queued() { const rows = database(); await service.ensureBookProducts(book); return rows; }
const success = async () => ({ status: 'ready', storeState: 'ACTIVE' });
const fail = async () => { throw Object.assign(new Error('secret credential'), { status: 403 }); };

test('stable product ID uses canonical Mongo ID and rejects malformed IDs', () => {
  assert.equal(service.stableProductId(bookId.toUpperCase()), sku);
  assert.equal(service.stableProductId(bookId), sku);
  assert.throws(() => service.stableProductId('random'));
});
test('successful provisioning links independent store states', async () => {
  const rows = await queued();
  await service.processStoreProduct('android', bookId, success);
  await service.processStoreProduct('ios', bookId, async (input) => {
    await input.checkpoint('apple-resource'); return { status: 'awaiting_review', resourceId: 'apple-resource' };
  });
  assert.equal(rows[0].android.productId, sku);
  assert.equal(rows[0].android.status, 'ready');
  assert.equal(rows[0].ios.productId, sku);
  assert.equal(rows[0].ios.resourceId, 'apple-resource');
  assert.equal(rows[0].ios.status, 'awaiting_review');
});
test('duplicate and simultaneous provisioning do not call a provider twice', async () => {
  const rows = await queued(); await service.ensureBookProducts(book);
  let calls = 0;
  const provider = async () => { calls++; return success(); };
  await Promise.all([service.processStoreProduct('android', bookId, provider), service.processStoreProduct('android', bookId, provider)]);
  await service.processStoreProduct('android', bookId, provider);
  assert.equal(calls, 1); assert.equal(rows.length, 1);
});
for (const failing of ['android', 'ios']) {
  test(`${failing} failure preserves the other successful store`, async () => {
    const rows = await queued(); const other = failing === 'android' ? 'ios' : 'android';
    await service.processStoreProduct(other, bookId, success);
    await service.processStoreProduct(failing, bookId, fail);
    assert.equal(rows[0][other].status, 'ready');
    assert.equal(rows[0][failing].status, 'failed');
    assert.match(rows[0][failing].error, /AUTHORIZATION_FAILED/);
    assert.doesNotMatch(rows[0][failing].error, /secret/);
    await service.retryBookProvisioning(bookId, failing);
    await service.processStoreProduct(failing, bookId, success);
    assert.equal(rows[0][failing].status, 'ready');
    assert.equal(rows[0][failing].attempts, 2);
    assert.equal(rows[0][failing].error, undefined);
  });
}
test('Apple management ID survives a failure and is supplied on retry', async () => {
  const rows = await queued();
  await service.processStoreProduct('ios', bookId, async (input) => { await input.checkpoint('123'); throw Error('metadata failed'); });
  assert.equal(rows[0].ios.resourceId, '123');
  await service.retryBookProvisioning(bookId, 'ios');
  await service.processStoreProduct('ios', bookId, async (input) => { assert.equal(input.resourceId, '123'); return success(); });
});
test('expired processing leases recover after a worker crash', async () => {
  const rows = await queued();
  Object.assign(rows[0].android, { status: 'processing', leaseUntil: new Date(0), leaseOwner: 'dead-worker' });
  assert.equal(await service.processStoreProduct('android', bookId, success), true);
  assert.equal(rows[0].android.status, 'ready');
});
test('legacy migration is idempotent, keeps historical IDs and fills only missing stores', async () => {
  const rows = database(); process.env.IAP_PRODUCTS_JSON = JSON.stringify({ [bookId]: { android: 'historical.book' } });
  assert.equal(await service.migrateLegacyMappings(), 1);
  assert.equal(await service.migrateLegacyMappings(), 0);
  await service.ensureBookProducts(book);
  assert.equal(rows[0].android.productId, 'historical.book');
  assert.equal(rows[0].android.status, 'legacy');
  assert.equal(rows[0].ios.productId, sku);
  assert.equal(await service.processStoreProduct('android', bookId, fail), false);
  assert.equal((await service.databaseProductMapping(true))[bookId].android, 'historical.book');
});
test('conflicting legacy mapping is rejected instead of silently replacing a SKU', async () => {
  const rows = await queued(); process.env.IAP_PRODUCTS_JSON = JSON.stringify({ [bookId]: { android: 'different' } });
  await assert.rejects(service.migrateLegacyMappings(), /conflicts/);
  assert.equal(rows[0].android.productId, sku);
});
test('free-to-premium conversion queues products; later price edits never change the snapshot', async () => {
  const rows = database(); assert.equal(await service.ensureBookProducts({ ...book, type: 'free', priceInr: 0 }), null);
  assert.equal(rows.length, 0);
  await service.ensureBookProducts(book); await service.ensureBookProducts({ ...book, priceInr: 199 });
  assert.equal(rows.length, 1); assert.equal(rows[0].initialPriceInr, 99);
  assert.throws(() => service.validatePremiumPrice({ ...book, priceInr: 0 }));
});
test('only ready/legacy products are offered; all mappings remain available for restoration', async () => {
  const rows = await queued(); await service.processStoreProduct('android', bookId, success);
  assert.deepEqual((await service.databaseProductMapping(true))[bookId], { android: sku });
  assert.deepEqual((await service.databaseProductMapping())[bookId], { android: sku, ios: sku });
  await service.ensureBookProducts({ ...book, status: 'draft', type: 'free', priceInr: 0 });
  assert.equal(rows[0].android.status, 'ready');
});
test('configured Apple products awaiting review are exposed only on a sandbox backend', async () => {
  const rows = await queued(); rows[0].ios.status = 'awaiting_review';
  process.env.APPLE_IAP_ENVIRONMENT = 'Production';
  assert.equal((await service.databaseProductMapping(true))[bookId], undefined);
  process.env.APPLE_IAP_ENVIRONMENT = 'Sandbox';
  assert.deepEqual((await service.databaseProductMapping(true))[bookId], { ios: sku });
});
test('missing credentials fail both stores safely and remain retryable', async () => {
  const rows = await queued();
  delete process.env.GOOGLE_PLAY_PACKAGE_NAME; delete process.env.APP_STORE_CONNECT_PRIVATE_KEY;
  await service.processStoreProduct('android', bookId); await service.processStoreProduct('ios', bookId);
  assert.match(rows[0].android.error, /MISSING_CONFIGURATION/);
  assert.match(rows[0].ios.error, /MISSING_CONFIGURATION/);
});
test('malformed store credentials are detected without leaking keys', async () => {
  const rows = await queued();
  Object.assign(process.env, { GOOGLE_PLAY_PACKAGE_NAME: 'com.test', GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: 'not-json',
    APP_STORE_CONNECT_PRIVATE_KEY: 'secret-invalid-key', APP_STORE_CONNECT_KEY_ID: 'key', APP_STORE_CONNECT_ISSUER_ID: 'issuer', APP_STORE_CONNECT_APP_ID: '123' });
  await service.processStoreProduct('android', bookId); await service.processStoreProduct('ios', bookId);
  assert.match(rows[0].android.error, /INVALID_CONFIGURATION/);
  assert.match(rows[0].ios.error, /INVALID_CONFIGURATION/);
  assert.doesNotMatch(rows[0].ios.error, /secret-invalid/);
});
test('admin product routes require authentication and admin authorization before handlers', async () => {
  assert.equal(adminRouter.stack[0].handle, authenticate);
  assert.equal(adminRouter.stack[1].handle, requireAdmin);
  let error;
  await authenticate({ headers: {} }, {}, (e) => { error = e; }); assert.equal(error.statusCode, 401);
  requireAdmin({ user: { role: 'user' } }, {}, (e) => { error = e; }); assert.equal(error.statusCode, 403);
  let passed = false; requireAdmin({ user: { role: 'admin' } }, {}, (e) => { assert.equal(e, undefined); passed = true; });
  assert.equal(passed, true);
});

function googleMock(existing = false) {
  Object.assign(process.env, { GOOGLE_PLAY_PACKAGE_NAME: 'com.test', GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: JSON.stringify({ client_email: 'mock@test', private_key: 'mock' }), GOOGLE_PLAY_REGIONS_VERSION: '2022/02' });
  const requests = []; let product = existing ? { productId: sku, purchaseOptions: [{ purchaseOptionId: 'buy', state: 'ACTIVE', buyOption: { legacyCompatible: true },
    regionalPricingAndAvailabilityConfigs: [{ regionCode: 'IN', availability: 'AVAILABLE', price: { currencyCode: 'INR', units: '199' } }] }] } : null;
  mock.method(GoogleAuth.prototype, 'getClient', async () => ({ request: async (r) => {
    requests.push(r);
    if (r.method === 'PATCH') product = structuredClone(r.data);
    else if (r.method === 'POST') product.purchaseOptions[0].state = 'ACTIVE';
    else if (!product) throw Object.assign(Error('not found'), { response: { status: 404 } });
    return { data: structuredClone(product) };
  } })); return requests;
}
const input = () => ({ productId: sku, title: book.title, description: book.description, priceInr: 99, checkpoint: async () => {} });
test('Google mock verifies official create/activate requests and duplicate read-only behavior', async () => {
  const requests = googleMock();
  assert.equal((await providers.provisionGoogle(input())).status, 'ready');
  const patch = requests.find((r) => r.method === 'PATCH');
  assert.equal(patch.params.allowMissing, true);
  assert.equal(patch.data.purchaseOptions[0].buyOption.legacyCompatible, true);
  assert.equal(patch.data.purchaseOptions[0].regionalPricingAndAvailabilityConfigs[0].price.units, '99');
  assert.match(requests.find((r) => r.method === 'POST').url, /purchaseOptions:batchUpdateStates$/);
  requests.length = 0; await providers.provisionGoogle(input()); assert.equal(requests.length, 1);
});
test('Google provisioning never overwrites an existing store price', async () => {
  const requests = googleMock(true); await providers.provisionGoogle(input());
  assert.equal(requests.length, 1); assert.equal(requests[0].method, undefined);
});
test('Google rejects unauthorized API credentials without creating a product', async () => {
  googleMock(); mock.restoreAll();
  mock.method(GoogleAuth.prototype, 'getClient', async () => ({ request: async () => { throw Object.assign(Error('secret'), { response: { status: 401 } }); } }));
  await assert.rejects(providers.provisionGoogle(input()));
});

function appleMock({ exactPrice = true, existing = false, approved = false } = {}) {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  Object.assign(process.env, { APP_STORE_CONNECT_PRIVATE_KEY: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    APP_STORE_CONNECT_KEY_ID: 'mock-key', APP_STORE_CONNECT_ISSUER_ID: 'mock-issuer', APP_STORE_CONNECT_APP_ID: '123' });
  const requests = []; let created = existing, localized = existing, schedule = existing, available = existing, version = existing;
  const product = { id: '456', attributes: { productId: sku, inAppPurchaseType: 'NON_CONSUMABLE', state: approved ? 'APPROVED' : 'MISSING_METADATA' } };
  mock.method(globalThis, 'fetch', async (url, options) => {
    const path = url.pathname; const method = options.method; const body = options.body && JSON.parse(options.body);
    requests.push({ path, method, body }); let data;
    if (path.endsWith('/inAppPurchasesV2')) data = created ? [product] : [];
    else if (path === '/v2/inAppPurchases' && method === 'POST') { created = true; data = product; }
    else if (path === '/v2/inAppPurchases/456') data = product;
    else if (path.endsWith('/versions')) data = version ? [{ id: 'v1', attributes: { state: approved ? 'APPROVED' : 'PREPARE_FOR_SUBMISSION' } }] : [];
    else if (path === '/v1/inAppPurchaseVersions') { version = true; data = { id: 'v1', attributes: { state: 'PREPARE_FOR_SUBMISSION' } }; }
    else if (path.endsWith('/localizations')) data = localized ? [{ id: 'locale', attributes: { locale: 'en-US' } }] : [];
    else if (path === '/v2/inAppPurchaseLocalizations') { localized = true; data = { id: 'locale' }; }
    else if (path.endsWith('/iapPriceSchedule')) { if (!schedule) return { ok: false, status: 404 }; data = { id: 'schedule' }; }
    else if (path.endsWith('/pricePoints')) data = [{ id: 'price99', attributes: { customerPrice: exactPrice ? '99.00' : '100.00' } }];
    else if (path === '/v1/inAppPurchasePriceSchedules') { schedule = true; data = { id: 'schedule' }; }
    else if (path.endsWith('/inAppPurchaseAvailability')) { if (!available) return { ok: false, status: 404 }; data = { id: 'availability' }; }
    else if (path === '/v1/inAppPurchaseAvailabilities') { available = true; data = { id: 'availability' }; }
    else throw Error(`Unexpected Apple mock path ${path}`);
    return { ok: true, json: async () => ({ data }) };
  }); return requests;
}
test('Apple mock creates non-consumable, version metadata, exact price and India availability without faking approval', async () => {
  const requests = appleMock(); let checkpoint;
  const result = await providers.provisionApple({ ...input(), checkpoint: async (id) => { checkpoint = id; } });
  assert.equal(checkpoint, '456'); assert.equal(result.status, 'awaiting_review');
  assert.equal(requests.find((r) => r.path === '/v2/inAppPurchases' && r.method === 'POST').body.data.attributes.inAppPurchaseType, 'NON_CONSUMABLE');
  assert.equal(requests.find((r) => r.path === '/v2/inAppPurchaseLocalizations').body.data.relationships.version.data.id, 'v1');
  const price = requests.find((r) => r.path === '/v1/inAppPurchasePriceSchedules').body;
  assert.equal(price.data.relationships.baseTerritory.data.id, 'IND');
  assert.equal(price.included[0].relationships.inAppPurchasePricePoint.data.id, 'price99');
  requests.length = 0; await providers.provisionApple({ ...input(), resourceId: '456' });
  assert.equal(requests.filter((r) => r.method === 'POST').length, 0);
});
test('Apple refuses to round a price to a different price point', async () => {
  const requests = appleMock({ exactPrice: false });
  await assert.rejects(providers.provisionApple(input()), /exact Apple INR/);
  assert.equal(requests.some((r) => r.path === '/v1/inAppPurchasePriceSchedules'), false);
});
test('approved Apple product is reused without repricing or new metadata', async () => {
  const requests = appleMock({ existing: true, approved: true });
  assert.equal((await providers.provisionApple(input())).status, 'ready');
  assert.equal(requests.some((r) => r.method === 'POST'), false);
});
test('Apple rejects unauthorized API credentials and never fabricates a management ID', async () => {
  appleMock(); mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 401 }));
  await assert.rejects(providers.provisionApple(input()));
});

async function dispatch(router, path, req) {
  const handler = router.stack.find((layer) => layer.route?.path === path).route.stack[0].handle;
  let body, error;
  await handler(req, { json: (value) => { body = value; } }, (value) => { error = value; });
  return { body, error };
}
test('existing product endpoint retains the Flutter contract using ready database mappings', async () => {
  await queued(); await service.processStoreProduct('android', bookId, success);
  mock.method(Content, 'find', (filter) => {
    assert.equal(filter.status, 'live');
    return { select: async () => [{ id: bookId }] };
  });
  const result = await dispatch(purchaseRouter, '/products', { user: { _id: 'user' } });
  assert.equal(result.error, undefined);
  assert.deepEqual(result.body.products, [{ bookId, android: sku }]);
  assert.equal(result.body.accountToken, purchaseService.accountToken('user'));
});
test('verification still grants only verified ownership and restores an unpublished mapped book', async () => {
  await queued();
  mock.method(Content, 'findOne', async (filter) => {
    assert.equal(filter.status, undefined); return { ...book, status: 'draft' };
  });
  mock.method(purchaseService, 'verifyStorePurchase', async (store, id) => {
    assert.equal(store, 'android'); assert.equal(id, sku); return { transactionKey: 'verified-key' };
  });
  mock.method(StorePurchase, 'init', async () => {});
  mock.method(StorePurchase, 'findOneAndUpdate', async () => ({ _id: 'claim', userId: 'user', bookId }));
  mock.method(StorePurchase, 'updateOne', async () => {});
  let unlocked = false;
  mock.method(User, 'updateOne', async (_, update) => { assert.equal(update.$addToSet.purchasedBooks, bookId); unlocked = true; });
  mock.method(User, 'findById', () => ({ select: async () => ({ purchasedBooks: [bookId] }) }));
  const req = { user: { _id: 'user' }, body: { store: 'android', productId: sku, verificationData: 'mock-token' } };
  const result = await dispatch(purchaseRouter, '/verify', req);
  assert.equal(result.error, undefined); assert.equal(unlocked, true);
  assert.deepEqual(result.body.purchasedBookIds, [bookId]);
  unlocked = false;
  mock.method(purchaseService, 'verifyStorePurchase', async () => { throw Error('rejected'); });
  assert.equal((await dispatch(purchaseRouter, '/verify', req)).error.statusCode, 503);
  assert.equal(unlocked, false);
});
for (const [name, method] of [['adminController', 'updateBook'], ['adminContentController', 'updateContent']]) {
  test(`${name} free-to-premium update queues the same database product mapping`, async () => {
    const rows = database();
    mock.method(Content, 'findById', async () => ({ ...book, type: 'free', priceInr: 0, lessons: [] }));
    mock.method(Content, 'findByIdAndUpdate', async (_, payload) => ({ ...book, ...payload, status: 'draft' }));
    const controller = require(`../dist/controllers/${name}`);
    let error, result;
    await controller[method]({ params: { id: bookId }, body: { type: 'premium', priceInr: 99 }, files: {} },
      { json: (value) => { result = value; } }, (e) => { error = e; });
    assert.equal(error, undefined); assert.equal(result.success, true);
    assert.equal(rows.length, 1); assert.equal(rows[0].android.productId, sku); assert.equal(rows[0].ios.productId, sku);
  });
}
for (const [name, method] of [['adminController', 'createBook'], ['adminContentController', 'createContent']]) {
  test(`${name} new premium creation persists products without calling either store`, async () => {
    const rows = database();
    const fs = require('node:fs/promises');
    mock.method(fs, 'mkdir', async () => {}); mock.method(fs, 'writeFile', async () => {});
    mock.method(Content, 'create', async (payload) => ({ id: bookId, ...payload }));
    const controller = require(`../dist/controllers/${name}`);
    let error, result, code;
    const req = { body: { ...book, status: 'draft', language: 'English', thumbnailUrl: '/image',
      intro: { title: 'Intro', mediaUrl: '/audio', mediaType: 'audio' }, lessons: [] },
      files: { thumbnail: [{ originalname: 'cover.png', mimetype: 'image/png', buffer: Buffer.from('mock') }] } };
    const res = { status: (value) => { code = value; return res; }, json: (value) => { result = value; } };
    await controller[method](req, res, (e) => { error = e; });
    assert.equal(error, undefined); assert.equal(code, 201); assert.equal(result.success, true);
    assert.equal(rows.length, 1); assert.equal(rows[0].android.status, 'pending'); assert.equal(rows[0].ios.status, 'pending');
  });
}
