import multer, { type FileFilterCallback } from 'multer';
import type { Request } from 'express';
import path from 'path';
import { BadRequestError } from '../utils/errors';

const storage = multer.memoryStorage();

function isAllowedMime(mime: string | undefined): boolean {
  if (!mime) return false;
  const normalized = mime.toLowerCase();
  if (['image/jpeg', 'image/png', 'image/webp', 'audio/mpeg', 'audio/mp3', 'audio/x-mpeg', 'video/mp4', 'video/webm'].includes(normalized)) return true;
  return false;
}

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void => {
  if (!isAllowedMime(file.mimetype)) {
    cb(new BadRequestError('Unsupported upload type. Use JPG/PNG/WebP images or MP3 audio.'));
    return;
  }
  cb(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 12,
    fields: 100,
    fieldSize: 1024 * 1024,
  },
});

// Admin Happy Bites audio is staged on disk instead of buffering an unlimited
// file in RAM. Other uploads keep the shared 50 MB limit above.
export const happyBiteAudioUpload = multer({
  storage: multer.diskStorage({}),
  fileFilter: (_req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() !== '.mp3'
      || !['audio/mpeg', 'audio/mp3', 'audio/x-mpeg'].includes(file.mimetype.toLowerCase())) {
      cb(new BadRequestError('Happy Bite audio must be an MP3 audio file.'));
      return;
    }
    cb(null, true);
  },
  limits: { files: 1, fields: 5, fieldSize: 1024 * 1024 },
});

