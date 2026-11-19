const { test } = require('node:test');
const assert = require('node:assert/strict');
const play = require('../dist/services/googlePlayConsole');

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
