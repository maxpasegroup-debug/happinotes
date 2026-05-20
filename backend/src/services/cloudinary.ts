import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { env } from '../config/env';

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

const uploadBuffer = (buffer: Buffer, folder: string, resourceType: 'image' | 'video') => {
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
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
};
