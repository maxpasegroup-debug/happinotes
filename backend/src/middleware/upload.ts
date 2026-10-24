import multer, { type FileFilterCallback } from 'multer';
import type { Request } from 'express';
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

