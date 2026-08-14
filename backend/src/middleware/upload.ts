import multer from 'multer';
import { BadRequestError } from '../utils/errors';

const storage = multer.memoryStorage();

const imageMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
const audioMimeTypes = ['audio/mpeg'];

export const imageUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!imageMimeTypes.includes(file.mimetype)) {
      callback(new BadRequestError('Only jpg, png, and webp images are allowed'));
      return;
    }
    callback(null, true);
  },
});

export const audioUpload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!audioMimeTypes.includes(file.mimetype)) {
      callback(new BadRequestError('Only MP3 audio files are allowed'));
      return;
    }
    callback(null, true);
  },
});
