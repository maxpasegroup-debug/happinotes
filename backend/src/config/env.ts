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
}

export const env = {
  NODE_ENV,
  PORT: parseInt(process.env.PORT || '3000', 10),
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/happinotes',
  JWT_SECRET: JWT_SECRET_RAW || JWT_SECRET_FALLBACK,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'arundasmd@gmail.com',
} as const;
