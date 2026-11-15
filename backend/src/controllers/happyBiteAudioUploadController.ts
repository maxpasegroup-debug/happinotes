import type { Request, Response, NextFunction } from 'express';
import { createReadStream } from 'fs';
import { randomUUID } from 'crypto';
import { unlink } from 'fs/promises';
import type { Writable } from 'stream';
import { cloudinary, configureCloudinary, isCloudinaryConfigured } from '../config/cloudinary';
import { validateAudioFile } from '../utils/mediaValidation';
import { AppError, BadRequestError } from '../utils/errors';

type AudioLimit = { account: string; bytes: number | null; expires: number };
let audioLimit: AudioLimit | undefined;

/** A provider allowance, never an application size/duration restriction. */
async function audioFileLimit(fileSize: number): Promise<number | null> {
  const account = `${process.env.CLOUDINARY_CLOUD_NAME}:${process.env.CLOUDINARY_API_KEY}`;
  const cached = audioLimit;
  // Recheck rejected sizes immediately so Retry sees an account upgrade.
  if (cached?.account === account && cached.expires > Date.now() &&
      (cached.bytes === null || fileSize <= cached.bytes)) return cached.bytes;
  let bytes: number | null = null;
  try {
    const usage = await cloudinary.api.usage({ timeout: 8000 });
    const reported = usage?.media_limits?.video_max_size_bytes;
    if (typeof reported === 'number' && Number.isSafeInteger(reported) && reported > 0) bytes = reported;
  } catch {
    // Restricted Admin API access must not break otherwise valid uploads.
    // Cloudinary remains authoritative and will enforce its upload limit.
    console.warn('happy_bite_audio_limit_lookup_unavailable');
  }
  audioLimit = { account, bytes, expires: Date.now() + 60_000 };
  return bytes;
}

// Return actionable categories without exposing raw provider responses or secrets.
function audioStorageError(error: unknown): AppError {
  const detail = error && typeof error === 'object' ? error as { message?: unknown; http_code?: unknown; code?: unknown } : {};
  const message = typeof detail.message === 'string' ? detail.message : '';
  if (detail.http_code === 413 || /file size too large|maximum file size|file.*exceeds.*size/i.test(message)) {
    return new AppError('Cloudinary rejected this audio because it exceeds your account’s per-file upload limit. Happy Bites has no audio size or duration cap. Increase the Cloudinary audio/video upload allowance before retrying this file.', 413);
  }
  if (/quota|credits.*exceed|storage.*limit|usage.*limit/i.test(message)) {
    return new AppError('Cloudinary storage or usage allowance has been reached. Check the media account’s usage limits before retrying.', 503);
  }
  if (detail.http_code === 408 || detail.http_code === 504 || detail.code === 'ETIMEDOUT' || /timed? ?out|timeout/i.test(message)) {
    return new AppError('Media storage timed out while receiving or processing the audio. This is not an audio-duration limit. Retry on a stable connection; if it repeats, check the storage provider and hosting timeout settings.', 504);
  }
  return new AppError('Media storage could not complete the audio upload. Please try again.', 503);
}

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
      const fail = (error?: unknown) => {
        if (settled) return;
        settled = true;
        source.destroy();
        destination?.destroy();
        const failure = audioStorageError(error);
        console.warn('happy_bite_audio_upload_failed', { statusCode: failure.statusCode, fileSizeBytes: file.size });
        void sourceClosed.then(() => reject(failure));
      };
      source.on('error', fail);
      try {
        destination = cloudinary.uploader.upload_chunked_stream({
          folder: 'happinotes/happy-bites/audio',
          resource_type: 'video',
          unique_filename: true,
          overwrite: false,
          chunk_size: 6 * 1024 * 1024,
          // Per-chunk idle timeout, not a file-size or audio-duration limit.
          timeout: 600_000,
        }, (error, uploaded) => {
          if (settled) return;
          if (error) { fail(error); return; }
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
      } catch (error) { fail(error); }
    });
    res.status(201).json({ success: true, mediaType: 'audio', ...result });
  } catch (error) { next(error); }
  finally {
    // Multer removes staged files on multipart failures; completed uploads are
    // removed here on success, validation failure and storage-provider failure.
    await unlink(file.path).catch(() => {});
  }
}

/** Sign only server-selected MP3 upload parameters; the API secret stays here. */
export async function signHappyBiteAudioUpload(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, size, type } = req.body || {};
    if (typeof name !== 'string' || name.length > 255 || !/\.mp3$/i.test(name) ||
        !Number.isSafeInteger(size) || size <= 0 ||
        (type && !['audio/mpeg', 'audio/mp3', 'audio/x-mpeg'].includes(String(type).toLowerCase()))) {
      throw new BadRequestError('Choose a non-empty MP3 audio file.');
    }
    if (!isCloudinaryConfigured()) throw new AppError('Media storage is not configured. Please contact an administrator.', 503);
    configureCloudinary();
    const maxFileSizeBytes = await audioFileLimit(size);
    if (maxFileSizeBytes !== null && size > maxFileSizeBytes) {
      const mib = (bytes: number) => (bytes / 1024 / 1024).toFixed(2);
      throw new AppError(`This MP3 is ${mib(size)} MiB (${size} bytes). Your Cloudinary audio/video per-file allowance is ${mib(maxFileSizeBytes)} MiB (${maxFileSizeBytes} bytes). Increase that allowance to cover this file, then press Retry upload. No audio was transferred. Happy Bites has no additional audio size or duration cap.`, 413);
    }
    const params = {
      timestamp: Math.floor(Date.now() / 1000),
      public_id: `happinotes/happy-bites/audio/${randomUUID()}`,
      overwrite: false,
      allowed_formats: 'mp3',
    };
    const signature = cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET!.trim());
    res.setHeader('Cache-Control', 'private, no-store');
    res.json({ cloudName: process.env.CLOUDINARY_CLOUD_NAME!.trim(), apiKey: process.env.CLOUDINARY_API_KEY!.trim(), signature, params, ...(maxFileSizeBytes !== null ? { maxFileSizeBytes } : {}) });
  } catch (error) { next(error); }
}
