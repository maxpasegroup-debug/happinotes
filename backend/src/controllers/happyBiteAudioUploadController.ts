import type { Request, Response, NextFunction } from 'express';
import { createReadStream } from 'fs';
import { unlink } from 'fs/promises';
import type { Writable } from 'stream';
import { cloudinary, configureCloudinary, isCloudinaryConfigured } from '../config/cloudinary';
import { validateAudioFile } from '../utils/mediaValidation';
import { AppError, BadRequestError } from '../utils/errors';

export async function uploadHappyBiteAudio(req: Request, res: Response, next: NextFunction): Promise<void> {
  const file = req.file;
  if (!file) { next(new BadRequestError('media file is required')); return; }
  try {
    const invalid = await validateAudioFile(file);
    if (invalid) throw new BadRequestError(invalid);
    if (!isCloudinaryConfigured()) throw new AppError('Media storage is not configured. Please contact an administrator.', 503);
    configureCloudinary();

    const result = await new Promise<{ url: string; durationSeconds?: number }>((resolve, reject) => {
      const source = createReadStream(file.path);
      const sourceClosed = new Promise<void>((done) => source.once('close', done));
      let destination: Writable | undefined;
      let settled = false;
      const fail = () => {
        if (settled) return;
        settled = true;
        source.destroy();
        destination?.destroy();
        void sourceClosed.then(() => reject(new AppError('Media storage could not complete the audio upload. Please try again.', 503)));
      };
      source.on('error', fail);
      try {
        destination = cloudinary.uploader.upload_chunked_stream({
          folder: 'happinotes/happy-bites/audio',
          resource_type: 'video',
          unique_filename: true,
          overwrite: false,
          chunk_size: 6 * 1024 * 1024,
          timeout: 120_000,
        }, (error, uploaded) => {
          if (settled) return;
          if (error) { fail(); return; }
          if (uploaded?.done === false) return;
          if (!uploaded?.secure_url || !uploaded.public_id) { fail(); return; }
          settled = true;
          source.destroy();
          const result = {
            url: uploaded.secure_url,
            ...(typeof uploaded.duration === 'number' && Number.isFinite(uploaded.duration)
              ? { durationSeconds: Math.round(uploaded.duration) } : {}),
          };
          void sourceClosed.then(() => resolve(result));
        });
        destination.on('error', fail);
        if (!settled) source.pipe(destination);
      } catch { fail(); }
    });
    res.status(201).json({ success: true, mediaType: 'audio', ...result });
  } catch (error) { next(error); }
  finally {
    // Multer removes staged files on multipart failures; completed uploads are
    // removed here on success, validation failure and storage-provider failure.
    await unlink(file.path).catch(() => {});
  }
}
