import dotenv from 'dotenv';

dotenv.config();

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/happinotes',
  USE_EMBEDDED_MONGODB: process.env.USE_EMBEDDED_MONGODB === 'true',
  JWT_SECRET: process.env.JWT_SECRET || 'fallback-secret-change-me',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || '',
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || '',
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || '',
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  RAZORPAY_MONTHLY_PLAN_ID: process.env.RAZORPAY_MONTHLY_PLAN_ID || '',
  RAZORPAY_YEARLY_PLAN_ID: process.env.RAZORPAY_YEARLY_PLAN_ID || '',
  ADMIN_EMAIL: (process.env.ADMIN_EMAIL || 'arjunmd@email.com').toLowerCase(),
  ADMIN_PHONE_NUMBER: process.env.ADMIN_PHONE_NUMBER || '+918089239823',
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  SMTP_FROM: process.env.SMTP_FROM || 'HappiNotes <no-reply@happinotes.app>',
  CORS_ORIGINS: process.env.CORS_ORIGINS || '',
  SENTRY_DSN: process.env.SENTRY_DSN || '',
  EXPO_ACCESS_TOKEN: process.env.EXPO_ACCESS_TOKEN || '',
  WHATSAPP_OTP_MODE: process.env.WHATSAPP_OTP_MODE || 'test',
  MEDIA_STORAGE_PATH: process.env.MEDIA_STORAGE_PATH || '',
  RAILWAY_VOLUME_MOUNT_PATH: process.env.RAILWAY_VOLUME_MOUNT_PATH || '',
} as const;
