import multer, { type FileFilterCallback } from 'multer';
import type { Request } from 'express';

const storage = multer.memoryStorage();

function isAllowedMime(mime: string | undefined): boolean {
  if (!mime) return false;
  if (mime.startsWith('image/')) return true;
  if (mime.startsWith('audio/')) return true;
  if (mime.startsWith('video/')) return true;
  return false;
}

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void => {
  if (!isAllowedMime(file.mimetype)) {
    cb(new Error('Unsupported file type'));
    return;
  }
  cb(null, true);
};

export const upload = multer({ storage, fileFilter });

