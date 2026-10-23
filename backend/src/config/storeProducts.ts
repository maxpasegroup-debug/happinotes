import { env } from './env';

export const STORE_PRODUCTS = {
  apple: {
    productId: 'com.happinotes.premium.monthly',
    bundleId: 'com.happinotes.app',
  },
  google: {
    productId: 'happinotes_premium_monthly',
    packageName: 'com.happinotes.app',
    basePlanId: 'monthly',
  },
} as const;

export const getStoreProduct = (store: string) => {
  if (store === 'apple') return STORE_PRODUCTS.apple;
  if (store === 'google') return STORE_PRODUCTS.google;
  return null;
};

export const storeVerificationConfig = {
  appleRootCertificates: env.APPLE_ROOT_CERTIFICATES_BASE64
    .split(',')
    .map((cert) => cert.trim())
    .filter(Boolean)
    .map((cert) => Buffer.from(cert, 'base64')),
  appleAppAppleId: env.APPLE_APP_ID ? Number(env.APPLE_APP_ID) : undefined,
  googleServiceAccount: env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON,
} as const;
