const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateImageUpload, validateLessonAudioUpload } = require('../dist/utils/mediaValidation');

function validCover() {
  return { originalname: 'cover.jpg', mimetype: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x01]) };
}

function validMp3(name = 'lesson.mp3') {
  return { originalname: name, mimetype: 'audio/mpeg', buffer: Buffer.concat([Buffer.from('ID3\x04\x00\x00\x00\x00\x00\x00', 'binary'), Buffer.from([0xff, 0xfb, 0x90, 0x64, 0x00, 0x00])]) };
}

test('accepts a cover only when the extension, MIME type, and image signature match', () => {
  assert.equal(validateImageUpload(validCover()), null);
  assert.match(validateImageUpload({ ...validCover(), originalname: 'cover.exe' }), /JPG, PNG, or WebP/);
  assert.match(validateImageUpload({ ...validCover(), mimetype: 'application/x-msdownload' }), /MIME type/);
  assert.match(validateImageUpload({ ...validCover(), buffer: Buffer.from('MZ executable') }), /not a valid image/);
});

test('accepts valid MP3 and rejects executables and unsupported audio formats', () => {
  assert.equal(validateLessonAudioUpload(validMp3()), null);
  assert.match(validateLessonAudioUpload({ ...validMp3('setup.exe'), mimetype: 'application/x-msdownload', buffer: Buffer.from('MZ') }), /MP3/);
  assert.match(validateLessonAudioUpload({ ...validMp3(), buffer: Buffer.from('MZ executable') }), /valid MP3/);
  assert.match(validateLessonAudioUpload({ ...validMp3('lesson.wav'), mimetype: 'audio/wav' }), /MP3/);
});
