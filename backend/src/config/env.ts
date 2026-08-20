import dotenv from 'dotenv';

dotenv.config();

const NODE_ENV = process.env.NODE_ENV || 'development';
const JWT_SECRET_RAW = process.env.JWT_SECRET;
const JWT_SECRET_FALLBACK = 'fallback-secret-change-me';

if (NODE_ENV === 'production') {
  if (!JWT_SECRET_RAW || JWT_SECRET_RAW === JWT_SECRET_FALLBACK) {
    throw new Error(
      'JWT_SECRET must be set to a secure value in production and must not use the fallback. Set JWT_SECRET in your environment.'
    );
  }
  if (!process.env.ADMIN_EMAIL || process.env.ADMIN_EMAIL.trim() === '') {
    throw new Error(
      'ADMIN_EMAIL must be set in production. Set ADMIN_EMAIL in your environment.'
    );
  }
  if (!process.env.GOOGLE_PLAY_SERVICE_ACCOUNT || process.env.GOOGLE_PLAY_SERVICE_ACCOUNT.trim() === '') {
    throw new Error(
      'GOOGLE_PLAY_SERVICE_ACCOUNT must be set in production. Set GOOGLE_PLAY_SERVICE_ACCOUNT in your environment.'
    );
  }
}

export const env = {
  NODE_ENV,
  PORT: parseInt(process.env.PORT || '3000', 10),
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/happinotes',
  JWT_SECRET: JWT_SECRET_RAW || JWT_SECRET_FALLBACK,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  ADMIN_EMAIL: process.env.ADMIN_EMAIL ?? undefined,
  ADMIN_PHONE_NUMBER: process.env.ADMIN_PHONE_NUMBER || '+918089239823',
  WHATSAPP_OTP_MODE: process.env.WHATSAPP_OTP_MODE || 'test',
} as const;
