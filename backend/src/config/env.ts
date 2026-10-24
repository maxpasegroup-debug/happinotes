import dotenv from 'dotenv';

dotenv.config();

const NODE_ENV = process.env.NODE_ENV || 'development';
const JWT_SECRET_RAW = process.env.JWT_SECRET;
const JWT_SECRET_FALLBACK = 'fallback-secret-change-me';
const WHATSAPP_OTP_MODE = (process.env.WHATSAPP_OTP_MODE || 'test').trim().toLowerCase();

export type RateLimitStoreConfiguration = {
  mode: 'memory';
  shared: false;
  warning: boolean;
};

/**
 * Only express-rate-limit's built-in process-local memory store is installed.
 * Fail closed for any requested shared-store mode instead of silently using
 * memory and implying that limits are shared across backend instances.
 */
export function resolveRateLimitStoreConfiguration(
  configuredMode: string | undefined,
  nodeEnv: string,
): RateLimitStoreConfiguration {
  const mode = configuredMode?.trim().toLowerCase();
  if (mode && mode !== 'memory') {
    throw new Error('RATE_LIMIT_STORE is unsupported; only the process-local memory store is configured.');
  }
  return { mode: 'memory', shared: false, warning: nodeEnv === 'production' };
}

/** Production JWT secrets must have at least 256 bits of material and avoid common placeholders. */
export function isStrongProductionJwtSecret(secret: string | undefined): boolean {
  if (!secret || secret === JWT_SECRET_FALLBACK || Buffer.byteLength(secret, 'utf8') < 32) return false;
  const normalized = secret.trim().toLowerCase();
  if (/change[-_ ]?me|replace[-_ ]?me|your[-_ ]|example|placeholder|development|test[-_ ]?secret/.test(normalized)) {
    return false;
  }
  return new Set(Buffer.from(secret, 'utf8')).size >= 12;
}

export type ProductionConfiguration = {
  nodeEnv: string;
  jwtSecret?: string;
  adminEmail?: string;
  whatsappOtpMode?: string;
  resendApiKey?: string;
  resendFromEmail?: string;
  rateLimitStore?: string;
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
  if (!isStrongProductionJwtSecret(configuration.jwtSecret)) {
    throw new Error(
      'JWT_SECRET must contain at least 32 UTF-8 bytes and 12 distinct bytes in production; configure a cryptographically random secret.',
    );
  }
  resolveRateLimitStoreConfiguration(configuration.rateLimitStore, configuration.nodeEnv);
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
  rateLimitStore: process.env.RATE_LIMIT_STORE,
});

const rateLimitStoreConfiguration = resolveRateLimitStoreConfiguration(
  process.env.RATE_LIMIT_STORE,
  NODE_ENV,
);

export const env = {
  NODE_ENV,
  PORT: parseInt(process.env.PORT || '3000', 10),
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/happinotes',
  JWT_SECRET: JWT_SECRET_RAW || JWT_SECRET_FALLBACK,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  RATE_LIMIT_STORE_MODE: rateLimitStoreConfiguration.mode,
  RATE_LIMIT_STORE_SHARED: rateLimitStoreConfiguration.shared,
  RATE_LIMIT_STORE_WARNING: rateLimitStoreConfiguration.warning,
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
