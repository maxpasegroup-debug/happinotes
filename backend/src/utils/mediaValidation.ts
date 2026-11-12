import path from 'path';
import { open } from 'fs/promises';

export interface UploadCandidate {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

const IMAGE_TYPES: Record<string, { mime: string[]; signature: (data: Buffer) => boolean }> = {
  '.jpg': { mime: ['image/jpeg'], signature: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  '.jpeg': { mime: ['image/jpeg'], signature: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  '.png': { mime: ['image/png'], signature: (b) => b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
  '.webp': { mime: ['image/webp'], signature: (b) => b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' },
};

function extension(file: UploadCandidate): string {
  return path.extname(file.originalname || '').toLowerCase();
}

export function validateImageUpload(file: UploadCandidate): string | null {
  const ext = extension(file);
  const rule = IMAGE_TYPES[ext];
  if (!rule) return 'Cover image must be a JPG, PNG, or WebP file.';
  if (!rule.mime.includes((file.mimetype || '').toLowerCase())) return 'Cover image extension and MIME type do not match.';
  if (!rule.signature(file.buffer)) return 'The selected cover file is not a valid image.';
  return null;
}

function isMp3(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  let start = 0;
  if (buffer.subarray(0, 3).toString('ascii') === 'ID3') {
    if (buffer.length < 10) return false;
    const tagBytes = buffer.subarray(6, 10);
    if (tagBytes.some((byte) => (byte & 0x80) !== 0)) return false;
    const tagLength = (tagBytes[0] << 21) | (tagBytes[1] << 14) | (tagBytes[2] << 7) | tagBytes[3];
    start = 10 + tagLength + ((buffer[5] & 0x10) !== 0 ? 10 : 0);
    if (start >= buffer.length) return false;
  }
  // MP3 frames begin with an 11-bit sync word. Search after any ID3 header.
  const end = Math.min(buffer.length - 1, start + 4096);
  for (let i = start; i < end; i += 1) {
    if (buffer[i] === 0xff && (buffer[i + 1] & 0xe0) === 0xe0) return true;
  }
  return false;
}

export function validateLessonAudioUpload(file: UploadCandidate): string | null {
  if (extension(file) !== '.mp3') return 'Lesson audio must be an MP3 file.';
  if (!['audio/mpeg', 'audio/mp3', 'audio/x-mpeg'].includes((file.mimetype || '').toLowerCase())) {
    return 'Lesson audio must be declared as an MP3 file.';
  }
  if (!isMp3(file.buffer)) return 'The selected lesson file is not a valid MP3 audio file.';
  return null;
}

/** Validate a staged MP3 with bounded reads, including files with large ID3 tags. */
export async function validateAudioFile(file: Pick<UploadCandidate, 'originalname' | 'mimetype'> & { path: string }): Promise<string | null> {
  const handle = await open(file.path, 'r');
  try {
    const header = Buffer.alloc(10);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    let offset = 0;
    if (header.subarray(0, 3).toString('ascii') === 'ID3') {
      if (bytesRead < 10 || header.subarray(6, 10).some((byte) => (byte & 0x80) !== 0)) {
        return 'The selected file is not a valid MP3 audio file.';
      }
      offset = 10 + ((header[6] << 21) | (header[7] << 14) | (header[8] << 7) | header[9]) + ((header[5] & 0x10) !== 0 ? 10 : 0);
    }
    const frames = Buffer.alloc(4097);
    const read = await handle.read(frames, 0, frames.length, offset);
    return validateLessonAudioUpload({ ...file, buffer: frames.subarray(0, read.bytesRead) });
  } finally { await handle.close(); }
}

export function validateMediaUpload(file: UploadCandidate, scope: string): string | null {
  if (scope === 'lesson') return validateLessonAudioUpload(file);
  if (scope === 'thumbnail') return validateImageUpload(file);
  if (file.mimetype?.toLowerCase().startsWith('audio/')) return validateLessonAudioUpload(file);
  if (file.mimetype?.toLowerCase() === 'image/jpeg' || file.mimetype?.toLowerCase() === 'image/png' || file.mimetype?.toLowerCase() === 'image/webp') {
    return validateImageUpload(file);
  }
  if (file.mimetype?.toLowerCase() === 'video/mp4' && extension(file) === '.mp4' && file.buffer.length >= 12 && file.buffer.toString('ascii', 4, 8) === 'ftyp') return null;
  if (file.mimetype?.toLowerCase() === 'video/webm' && extension(file) === '.webm' && file.buffer.length >= 4 && file.buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return null;
  return 'Supported media: MP3 audio, MP4 video, WebM video, or JPG/PNG/WebP image.';
}
