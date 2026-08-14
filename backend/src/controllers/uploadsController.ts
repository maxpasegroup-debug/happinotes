import { Request, Response, NextFunction } from 'express';
import { BadRequestError } from '../utils/errors';
import {
  isCloudinaryConfigured,
  uploadAudio,
  uploadImage,
  uploadLocalMedia,
} from '../services/cloudinary';
import { env } from '../config/env';

const extensionFor = (mimeType: string, kind: 'cover' | 'audio') => {
  const extensions: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/aac': 'aac',
    'audio/x-m4a': 'm4a',
    'audio/m4a': 'm4a',
  };
  return extensions[mimeType] || (kind === 'cover' ? 'jpg' : 'mp3');
};

export const uploadBookCover = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.file) return next(new BadRequestError('Select an image to upload'));
    if (!isCloudinaryConfigured && env.NODE_ENV !== 'development') {
      return next(new BadRequestError('Media storage is not configured'));
    }
    const media = isCloudinaryConfigured
      ? await uploadImage(req.file.buffer)
      : await uploadLocalMedia(req.file.buffer, 'covers', extensionFor(req.file.mimetype, 'cover'));
    const responseMedia = 'path' in media
      ? { url: `${req.protocol}://${req.get('host')}${media.path}`, publicId: media.publicId }
      : media;
    res.status(201).json({ success: true, media: responseMedia });
  } catch (error) {
    next(error);
  }
};

export const uploadBookAudio = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.file) return next(new BadRequestError('Select an audio file to upload'));
    if (!isCloudinaryConfigured && env.NODE_ENV !== 'development') {
      return next(new BadRequestError('Media storage is not configured'));
    }
    const media = isCloudinaryConfigured
      ? await uploadAudio(req.file.buffer)
      : await uploadLocalMedia(req.file.buffer, 'audio', extensionFor(req.file.mimetype, 'audio'));
    const responseMedia = 'path' in media
      ? { url: `${req.protocol}://${req.get('host')}${media.path}`, publicId: media.publicId }
      : media;
    res.status(201).json({ success: true, media: responseMedia });
  } catch (error) {
    next(error);
  }
};
