import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const NODE_ENV = process.env.NODE_ENV || 'development';
const configuredJwtSecret = process.env.JWT_SECRET?.trim() || '';
const isPlaceholderSecret = /(replace|change[-_ ]?me|example|placeholder|password|secret)/i.test(configuredJwtSecret);

if (NODE_ENV === 'production') {
  if (configuredJwtSecret.length < 32 || new Set(configuredJwtSecret).size < 12 || isPlaceholderSecret) {
    throw new Error('Production requires a strong JWT_SECRET of at least 32 characters.');
  }
  if (!process.env.RESEND_API_KEY?.trim() || !process.env.RESEND_FROM?.trim()) {
    throw new Error('Production requires RESEND_API_KEY and RESEND_FROM for password recovery.');
  }
}

if (!configuredJwtSecret && NODE_ENV !== 'production') {
  console.warn('JWT_SECRET is unset; using a temporary random secret for this development run.');
}

export const env = {
  NODE_ENV,
  PORT: parseInt(process.env.PORT || '3000', 10),
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/happinotes',
  USE_EMBEDDED_MONGODB: process.env.USE_EMBEDDED_MONGODB === 'true',
  JWT_SECRET: configuredJwtSecret || crypto.randomBytes(32).toString('hex'),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || '',
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  RESEND_FROM: process.env.RESEND_FROM || '',
  APPLE_ROOT_CERTIFICATES_BASE64: process.env.APPLE_ROOT_CERTIFICATES_BASE64 || '',
  APPLE_APP_ID: process.env.APPLE_APP_ID || '',
  GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON || '',
  GOOGLE_PUBSUB_AUDIENCE: process.env.GOOGLE_PUBSUB_AUDIENCE || '',
  GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL: process.env.GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL || '',
  CORS_ORIGINS: process.env.CORS_ORIGINS || '',
  SENTRY_DSN: process.env.SENTRY_DSN || '',
  EXPO_ACCESS_TOKEN: process.env.EXPO_ACCESS_TOKEN || '',
  MEDIA_STORAGE_PATH: process.env.MEDIA_STORAGE_PATH || '',
  RAILWAY_VOLUME_MOUNT_PATH: process.env.RAILWAY_VOLUME_MOUNT_PATH || '',
} as const;
