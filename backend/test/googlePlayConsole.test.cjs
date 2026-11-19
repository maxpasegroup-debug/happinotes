const { test } = require('node:test');
const assert = require('node:assert/strict');
const play = require('../dist/services/googlePlayConsole');

test('store availability uses production lifecycle and independently paginated active base plans', async t => {
  const pkg = 'com.example.library';
  const previous = { ...process.env };
  process.env.GOOGLE_PLAY_PACKAGE_NAMES = pkg;
  process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON = JSON.stringify({client_email:'test@example.com', private_key:'test'});
  t.after(() => {
    for (const key of ['GOOGLE_PLAY_PACKAGE_NAMES','GOOGLE_PLAY_SERVICE_ACCOUNT_JSON']) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });
  t.mock.method(require('google-auth-library').GoogleAuth.prototype, 'getClient', async () => ({ getAccessToken: async () => ({token:'test'}) }));
  let production = 'DRAFT', subscriptions = 'active';
  t.mock.method(global, 'fetch', async url => {
    const path = new URL(url);
    if (path.pathname.endsWith('/tracks/production/releases')) {
      return Response.json({releases:[{releaseLifecycleState:'RELEASE_LIFECYCLE_STATE_' + production}]});
    }
    assert.ok(path.pathname.endsWith('/subscriptions'));
    if (subscriptions === 'denied') return Response.json({}, {status:403});
    if (subscriptions === 'empty') return Response.json({});
    return Response.json(path.searchParams.has('pageToken')
      ? {subscriptions:[{basePlans:[{state:'ACTIVE'}]}]}
      : {subscriptions:[{basePlans:[{state:'INACTIVE'}]}],nextPageToken:'next'});
  });
  assert.deepEqual(await play.getStoreAvailability(pkg), {subscriptions:'enabled',production:'unpublished',listingUrl:null});
  production = 'PUBLISHED'; subscriptions = 'denied';
  assert.deepEqual(await play.getStoreAvailability(pkg), {subscriptions:'unknown',subscriptionReason:'Google denied this request. Check API enablement and app permissions.',production:'published',listingUrl:'https://play.google.com/store/apps/details?id=' + pkg});
  production = 'UNSPECIFIED'; subscriptions = 'empty';
  assert.deepEqual(await play.getStoreAvailability(pkg), {subscriptions:'disabled',production:'unknown', productionReason:'Google returned an unspecified production release state.',listingUrl:null});
});

test('Google Play package configuration supports multiple validated packages', () => {
  const previous = process.env.GOOGLE_PLAY_PACKAGE_NAMES;
  process.env.GOOGLE_PLAY_PACKAGE_NAMES = 'com.happinotes.app, com.example.reader\ninvalid package';
  try {
    assert.deepEqual(play.parseGooglePlayPackageNames(), ['com.happinotes.app', 'com.example.reader']);
  } finally {
    if (previous === undefined) delete process.env.GOOGLE_PLAY_PACKAGE_NAMES;
    else process.env.GOOGLE_PLAY_PACKAGE_NAMES = previous;
  }
});

test('Google Play status and credential metadata are safe for the admin UI', () => {
  assert.equal(play.normalizeReleaseStatus('inProgress'), 'in progress');
  assert.equal(play.normalizeReleaseStatus(undefined), 'Status unavailable through API');
  assert.equal(play.maskServiceAccountEmail('happinotes-play@happinotes-cd8f6.iam.gserviceaccount.com'), 'ha…@happinotes-cd8f6.iam.gserviceaccount.com');
  assert.equal(play.maskServiceAccountEmail('not-an-email'), undefined);
});
