const { test } = require('node:test');
const assert = require('node:assert/strict');
const play = require('../dist/services/googlePlayConsole');

test('custom track review data survives an independently denied production call', async t => {
  const pkg = 'com.example.monitor';
  for (const [key,value] of Object.entries({ GOOGLE_PLAY_PACKAGE_NAMES: pkg, GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: JSON.stringify({client_email:'monitor@example.com',private_key:'test'}) })) {
    const old = process.env[key]; process.env[key] = value;
    t.after(() => { if (old === undefined) delete process.env[key]; else process.env[key] = old; });
  }
  play.clearGooglePlayCache();
  t.after(() => play.clearGooglePlayCache());
  t.mock.method(require('google-auth-library').GoogleAuth.prototype, 'getClient', async () => ({getAccessToken:async()=>({token:'test'})}));
  let denied = true;
  t.mock.method(global, 'fetch', async (url, options) => {
    const route = new URL(url).pathname;
    if (route.endsWith('/edits')) return Response.json({id:'snapshot'});
    if (options.method === 'DELETE') return new Response(null,{status:204});
    if (route.endsWith('/snapshot/tracks')) return Response.json({tracks:[{track:'production'},{track:'closed-preview'}]});
    if (route.endsWith('/subscriptions')) return Response.json({});
    if (route.endsWith('/production/releases')) return denied ? Response.json({}, {status:403}) : Response.json({});
    assert.ok(route.endsWith('/closed-preview/releases'));
    return Response.json({releases:[{releaseName:'build',releaseLifecycleState:'RELEASE_LIFECYCLE_STATE_IN_REVIEW',activeArtifacts:[{versionCode:19}]}]});
  });
  const partial = await play.getOverview();
  assert.equal(partial.totals.inReview, null);
  assert.deepEqual(partial.apps[0].lifecycle[1].releases[0].codes,['19']);
  denied = false; play.clearGooglePlayCache();
  assert.equal((await play.getOverview()).totals.inReview, 1);
});

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

test('analytics distinguishes a disabled Reporting API from denied app access', async t => {
  const pkg = 'com.example.analytics';
  const env = { GOOGLE_PLAY_PACKAGE_NAMES: pkg, GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: JSON.stringify({client_email:'analytics@example.com', private_key:'test'}) };
  for (const [key,value] of Object.entries(env)) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
  t.mock.method(require('google-auth-library').GoogleAuth.prototype, 'getClient', async () => ({getAccessToken: async () => ({token:'test'})}));
  let disabled = true;
  t.mock.method(global, 'fetch', async () => Response.json({error:{details:disabled ? [{reason:'SERVICE_DISABLED'}] : []}}, {status:403}));
  const setup = await play.getAnalytics(pkg);
  assert.equal(setup.enableReporting, true);
  assert.match(setup.reason, /Enable the Google Play Developer Reporting API/);
  disabled = false;
  const denied = await play.getAnalytics(pkg);
  assert.equal(denied.enableReporting, undefined);
  assert.match(denied.reason, /app permissions/);
});

test('Google Play status and credential metadata are safe for the admin UI', () => {
  assert.equal(play.normalizeReleaseStatus('inProgress'), 'in progress');
  assert.equal(play.normalizeReleaseStatus(undefined), 'Status unavailable through API');
  assert.equal(play.maskServiceAccountEmail('happinotes-play@happinotes-cd8f6.iam.gserviceaccount.com'), 'ha…@happinotes-cd8f6.iam.gserviceaccount.com');
  assert.equal(play.maskServiceAccountEmail('not-an-email'), undefined);
});
