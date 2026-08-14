import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { env } from '../config/env';
import { mkdir, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

export const isCloudinaryConfigured = Boolean(
  env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET
);

export const uploadLocalMedia = async (
  buffer: Buffer,
  kind: 'covers' | 'audio',
  extension: string
) => {
  const directory = path.resolve(process.cwd(), 'uploads', kind);
  await mkdir(directory, { recursive: true });
  const filename = `${randomUUID()}.${extension}`;
  await writeFile(path.join(directory, filename), buffer);
  return {
    path: `/uploads/${kind}/${filename}`,
    publicId: `local:${kind}/${filename}`,
  };
};

const uploadBuffer = (buffer: Buffer, folder: string, resourceType: 'image' | 'video') => {
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary is not configured. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.');
  }

  return new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
      },
      (error, result) => {
        if (error || !result) {
          reject(error || new Error('Cloudinary upload failed'));
          return;
        }
        resolve(result);
      }
    );

    stream.end(buffer);
  });
};

export const uploadAudio = async (buffer: Buffer, folder = 'happinotes/audio') => {
  const result = await uploadBuffer(buffer, folder, 'video');
  return { url: result.secure_url, publicId: result.public_id };
};

export const uploadImage = async (buffer: Buffer, folder = 'happinotes/covers') => {
  const result = await uploadBuffer(buffer, folder, 'image');
  return { url: result.secure_url, publicId: result.public_id };
};

export const deleteMedia = async (publicId: string, resourceType: 'image' | 'video' = 'image') => {
  if (!publicId) return;
  if (publicId.startsWith('local:')) {
    const relativePath = publicId.slice('local:'.length);
    if (!/^(covers|audio)\/[a-f0-9-]+\.[a-z0-9]+$/i.test(relativePath)) return;
    await unlink(path.resolve(process.cwd(), 'uploads', relativePath)).catch(() => undefined);
    return;
  }
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) return;
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
};
