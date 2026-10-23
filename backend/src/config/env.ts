import dotenv from 'dotenv';

dotenv.config();

const NODE_ENV = process.env.NODE_ENV || 'development';
const JWT_SECRET_RAW = process.env.JWT_SECRET;
const JWT_SECRET_FALLBACK = 'fallback-secret-change-me';
const WHATSAPP_OTP_MODE = (process.env.WHATSAPP_OTP_MODE || 'test').trim().toLowerCase();

export type ProductionConfiguration = {
  nodeEnv: string;
  jwtSecret?: string;
  adminEmail?: string;
  whatsappOtpMode?: string;
  resendApiKey?: string;
  resendFromEmail?: string;
};

/**
 * The repository has a real Resend email OTP provider, but it has no WhatsApp
 * or SMS provider. Production therefore fails closed unless phone OTP is
 * explicitly disabled; local/test mode may use generated test codes.
 * Keep this as a pure function so startup validation can be tested without
 * loading a live app.
 */
export function validateProductionConfiguration(configuration: ProductionConfiguration): void {
  if (configuration.nodeEnv !== 'production') return;
  if (!configuration.jwtSecret || configuration.jwtSecret === JWT_SECRET_FALLBACK) {
    throw new Error(
      'JWT_SECRET must be set to a secure value in production and must not use the fallback. Set JWT_SECRET in your environment.',
    );
  }
  const adminEmail = configuration.adminEmail?.trim().toLowerCase();
  if (!adminEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
    throw new Error('ADMIN_EMAIL must be set to a valid email in production.');
  }
  if (configuration.whatsappOtpMode !== 'disabled') {
    throw new Error(
      'WHATSAPP_OTP_MODE must be set to disabled in production because no phone OTP provider is implemented. Email OTP uses Resend.',
    );
  }
  if (!configuration.resendApiKey || configuration.resendApiKey.trim() === '') {
    throw new Error('RESEND_API_KEY must be set in production for email OTP delivery.');
  }
  if (!configuration.resendFromEmail ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configuration.resendFromEmail.trim())) {
    throw new Error('RESEND_FROM_EMAIL must be set to a valid email in production.');
  }
}

validateProductionConfiguration({
  nodeEnv: NODE_ENV,
  jwtSecret: JWT_SECRET_RAW,
  adminEmail: process.env.ADMIN_EMAIL,
  whatsappOtpMode: WHATSAPP_OTP_MODE,
  resendApiKey: process.env.RESEND_API_KEY,
  resendFromEmail: process.env.RESEND_FROM_EMAIL,
});

export const env = {
  NODE_ENV,
  PORT: parseInt(process.env.PORT || '3000', 10),
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/happinotes',
  JWT_SECRET: JWT_SECRET_RAW || JWT_SECRET_FALLBACK,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  ADMIN_EMAIL: process.env.ADMIN_EMAIL?.trim() || undefined,
  /** Optional legacy value; it never grants the admin role by itself. */
  ADMIN_PHONE_NUMBER: process.env.ADMIN_PHONE_NUMBER?.trim() || undefined,
  WHATSAPP_OTP_MODE,
  /** Used only when the configured administrator does not exist yet. */
  ADMIN_BOOTSTRAP_PASSWORD: process.env.ADMIN_BOOTSTRAP_PASSWORD?.trim() || undefined,
  RESEND_API_KEY: process.env.RESEND_API_KEY ?? '',
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL || 'no-reply@happinotes.online',
  FIREBASE_SERVICE_ACCOUNT_JSON: process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? '',
} as const;
