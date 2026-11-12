import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_BITE, uploadedAudioDuration, validateBiteDraft, validateBiteFile } from '../lib/happy-bites-admin.ts';

const image = { name: 'cover.png', type: 'image/png', size: 1024 };
const audio = { name: 'bite.mp3', type: 'audio/mpeg', size: 1024 };

test('Happy Bites uploads accept supported images and MP3 audio', () => {
  assert.equal(validateBiteFile('thumbnail', image), null);
  assert.equal(validateBiteFile('thumbnail', { ...image, name: 'COVER.JPG', type: 'image/jpeg' }), null);
  assert.equal(validateBiteFile('audio', audio), null);
  assert.equal(validateBiteFile('audio', { ...audio, type: '' }), null);
});

test('wrong media type, unsupported format, empty files and oversized thumbnails are rejected', () => {
  assert.ok(validateBiteFile('thumbnail', audio));
  assert.ok(validateBiteFile('audio', image));
  assert.ok(validateBiteFile('audio', { ...audio, type: 'video/mp4' }));
  assert.ok(validateBiteFile('audio', { ...audio, name: 'clip.wav' }));
  assert.ok(validateBiteFile('thumbnail', { ...image, size: 0 }));
  assert.ok(validateBiteFile('thumbnail', { ...image, size: 5 * 1024 * 1024 + 1 }));
  assert.ok(validateBiteFile('audio', { ...audio, size: 0 }));
});

test('Happy Bites MP3 audio has no application file-size cap', () => {
  for (const size of [50 * 1024 * 1024, 50 * 1024 * 1024 + 1, 1024 * 1024 * 1024]) {
    assert.equal(validateBiteFile('audio', { ...audio, size }), null);
  }
});

test('duration uses server metadata, falls back locally, and resets if replacement metadata is unknown', () => {
  assert.equal(uploadedAudioDuration(59.6, 40), 60);
  assert.equal(uploadedAudioDuration(undefined, 55.3), 55);
  assert.equal(uploadedAudioDuration(0, 60), 60);
  assert.equal(uploadedAudioDuration(Infinity, NaN), 0);
  assert.equal(uploadedAudioDuration(undefined, undefined), 0);
  assert.equal(uploadedAudioDuration(120), 120);
});

test('draft validation requires content and media but permits audio longer than one minute', () => {
  assert.ok(validateBiteDraft({ ...EMPTY_BITE }));
  const valid = { ...EMPTY_BITE, title: 'A happy thought', description: 'A short reflection.', thumbnailUrl: 'https://media.test/cover.png', audioUrl: 'https://media.test/bite.mp3', durationSeconds: 180 };
  assert.equal(validateBiteDraft(valid), null);
  for (const field of ['title', 'description', 'category', 'thumbnailUrl', 'audioUrl']) {
    assert.ok(validateBiteDraft({ ...valid, [field]: '' }));
  }
  for (const value of [-1, 1.5, NaN, Infinity]) assert.ok(validateBiteDraft({ ...valid, displayOrder: value }));
  assert.ok(validateBiteDraft({ ...valid, durationSeconds: -1 }));
  assert.equal(validateBiteDraft({ ...valid, durationSeconds: 0 }), null);
});

test('Happy Bites default to free and accept only free or premium access', () => {
  assert.equal(EMPTY_BITE.accessType, 'free');
  const valid = { ...EMPTY_BITE, title: 'Thought', description: 'Description', thumbnailUrl: '/t.jpg', audioUrl: '/a.mp3' };
  for (const accessType of ['free', 'premium']) assert.equal(validateBiteDraft({ ...valid, accessType }), null);
  for (const accessType of ['paid', '', undefined, null]) assert.match(validateBiteDraft({ ...valid, accessType }), /Free or Premium/);
});
