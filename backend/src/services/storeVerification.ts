import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import {
  Environment as AppleEnvironment,
  SignedDataVerifier,
} from '@apple/app-store-server-library';
import { storeVerificationConfig, STORE_PRODUCTS } from '../config/storeProducts';
import { AppError, BadRequestError } from '../utils/errors';

const serviceUnavailable = (message: string) => new AppError(message, 503);

export type VerifiedStorePurchase = {
  store: 'apple' | 'google';
  productId: string;
  transactionKey: string;
  latestTransactionId: string | null;
  purchaseTokenHash: string;
  expiresAt: Date;
  active: boolean;
  accountId?: string;
  signedDate?: Date | null;
  willRenew?: boolean | null;
};

export type VerifiedAppleNotification = {
  notificationUUID: string;
  notificationType: string;
  subtype?: string | null;
  signedTransactionInfo?: string;
  signedRenewalInfo?: string;
  signedDate?: number;
};

const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

export const getStoreAccountToken = (storedToken: string) => storedToken;
export const getGoogleObfuscatedAccountId = (storedToken: string) => sha256(storedToken).slice(0, 64);

const decodeUntrustedAppleEnvironment = (jws: string): string => {
  try {
    const payload = JSON.parse(Buffer.from(jws.split('.')[1], 'base64url').toString('utf8')) as {
      environment?: string;
      data?: { environment?: string };
    };
    return payload.environment || payload.data?.environment || '';
  } catch {
    return '';
  }
};

const getAppleVerifier = (signedData: string) => {
  if (!storeVerificationConfig.appleRootCertificates.length) {
    throw serviceUnavailable('Apple purchase verification is not configured');
  }
  if (!Number.isFinite(storeVerificationConfig.appleAppAppleId) || !storeVerificationConfig.appleAppAppleId) {
    throw serviceUnavailable('Apple App Store ID is not configured');
  }
  const environmentName = decodeUntrustedAppleEnvironment(signedData);
  const environment = environmentName === 'Sandbox' ? AppleEnvironment.SANDBOX : AppleEnvironment.PRODUCTION;
  return new SignedDataVerifier(
    storeVerificationConfig.appleRootCertificates,
    true,
    environment,
    STORE_PRODUCTS.apple.bundleId,
    environment === AppleEnvironment.PRODUCTION ? storeVerificationConfig.appleAppAppleId : undefined
  );
};

export const verifyAppleNotification = async (signedPayload: string): Promise<VerifiedAppleNotification> => {
  const verifier = getAppleVerifier(signedPayload);
  const notification = await verifier.verifyAndDecodeNotification(signedPayload);
  if (!notification.notificationUUID || !notification.notificationType) {
    throw new BadRequestError('Apple notification is missing its event identity');
  }
  return {
    notificationUUID: notification.notificationUUID,
    notificationType: notification.notificationType,
    subtype: notification.subtype,
    signedTransactionInfo: notification.data?.signedTransactionInfo,
    signedRenewalInfo: notification.data?.signedRenewalInfo,
    signedDate: notification.signedDate,
  };
};

export const verifyAppleNotificationTransaction = async (signedTransaction: string) => {
  return getAppleVerifier(signedTransaction).verifyAndDecodeTransaction(signedTransaction);
};

export const verifyAppleNotificationRenewal = async (signedRenewalInfo: string) =>
  getAppleVerifier(signedRenewalInfo).verifyAndDecodeRenewalInfo(signedRenewalInfo);

const verifyApplePurchase = async (
  signedTransaction: string,
  expectedAccountToken: string
): Promise<VerifiedStorePurchase> => {
  const verifier = getAppleVerifier(signedTransaction);
  const transaction = await verifier.verifyAndDecodeTransaction(signedTransaction);

  if (
    transaction.bundleId !== STORE_PRODUCTS.apple.bundleId ||
    transaction.productId !== STORE_PRODUCTS.apple.productId ||
    transaction.appAccountToken?.toLowerCase() !== expectedAccountToken.toLowerCase() ||
    !transaction.originalTransactionId ||
    !transaction.transactionId ||
    !transaction.expiresDate
  ) {
    throw new BadRequestError('Apple purchase does not match this account or product');
  }

  const expiresAt = new Date(transaction.expiresDate);
  const signedDate = transaction.signedDate ? new Date(transaction.signedDate) : null;
  const revoked = transaction.revocationDate !== undefined && transaction.revocationDate !== null;
  return {
    store: 'apple',
    productId: transaction.productId,
    transactionKey: transaction.originalTransactionId,
    latestTransactionId: transaction.transactionId,
    purchaseTokenHash: sha256(signedTransaction),
    expiresAt,
    active: !revoked && expiresAt.getTime() > Date.now(),
    signedDate,
  };
};

let cachedGoogleAccessToken = '';
let googleTokenExpiresAt = 0;

const getGoogleAccessToken = async (): Promise<string> => {
  if (!storeVerificationConfig.googleServiceAccount) {
    throw serviceUnavailable('Google Play purchase verification is not configured');
  }

  if (cachedGoogleAccessToken && googleTokenExpiresAt > Date.now() + 60_000) {
    return cachedGoogleAccessToken;
  }

  let credentials: { client_email?: string; private_key?: string; private_key_id?: string };
  try {
    credentials = JSON.parse(storeVerificationConfig.googleServiceAccount) as typeof credentials;
  } catch {
    throw serviceUnavailable('Google Play service account JSON is invalid');
  }

  if (!credentials.client_email || !credentials.private_key) {
    throw serviceUnavailable('Google Play service account JSON is missing required credentials');
  }

  const assertion = jwt.sign(
    { scope: 'https://www.googleapis.com/auth/androidpublisher' },
    credentials.private_key,
    {
      algorithm: 'RS256',
      keyid: credentials.private_key_id,
      issuer: credentials.client_email,
      audience: 'https://oauth2.googleapis.com/token',
      expiresIn: '1h',
    }
  );
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!tokenResponse.ok) {
    throw serviceUnavailable('Google Play service account could not authorize API access');
  }
  const tokenData = await tokenResponse.json() as { access_token?: string; expires_in?: number };
  if (!tokenData.access_token) throw serviceUnavailable('Google Play did not return an API access token');
  cachedGoogleAccessToken = tokenData.access_token;
  googleTokenExpiresAt = Date.now() + (tokenData.expires_in || 3600) * 1000;
  return cachedGoogleAccessToken;
};

const verifyGooglePurchase = async (
  purchaseToken: string,
  productId: string,
  expectedAccountId?: string
): Promise<VerifiedStorePurchase> => {
  if (productId !== STORE_PRODUCTS.google.productId) {
    throw new BadRequestError('Google Play product is not recognized');
  }

  const accessToken = await getGoogleAccessToken();
  const verificationUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(
    STORE_PRODUCTS.google.packageName
  )}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;
  let subscription: {
    lineItems?: Array<{
      productId?: string | null;
      expiryTime?: string | null;
      latestSuccessfulOrderId?: string | null;
      offerDetails?: { basePlanId?: string | null };
    }>;
    subscriptionState?: string | null;
    acknowledgementState?: string | null;
    autoRenewingPlan?: { autoRenewEnabled?: boolean };
    externalAccountIdentifiers?: { obfuscatedExternalAccountId?: string | null };
    linkedPurchaseToken?: string | null;
  };
  let response: Response;
  try {
    response = await fetch(verificationUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw serviceUnavailable('Google Play purchase verification is temporarily unavailable');
  }
  if (response.status === 404 || response.status === 400) {
    throw new BadRequestError('Google Play could not verify this purchase');
  }
  if (!response.ok) throw serviceUnavailable('Google Play purchase verification is temporarily unavailable');
  try {
    subscription = await response.json() as typeof subscription;
  } catch {
    throw serviceUnavailable('Google Play returned an invalid verification response');
  }

  const lineItem = subscription.lineItems?.find((item) => item.productId === productId);
  const state = subscription.subscriptionState;
  const expiresAt = lineItem?.expiryTime ? new Date(lineItem.expiryTime) : null;
  const accountId = subscription.externalAccountIdentifiers?.obfuscatedExternalAccountId;
  if (
    !lineItem ||
    lineItem.offerDetails?.basePlanId !== STORE_PRODUCTS.google.basePlanId ||
    !expiresAt ||
    Number.isNaN(expiresAt.getTime()) ||
    (expectedAccountId !== undefined && accountId !== expectedAccountId)
  ) {
    throw new BadRequestError('Google Play purchase does not match this account or product');
  }

  const activeStates = new Set([
    'SUBSCRIPTION_STATE_ACTIVE',
    'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',
    'SUBSCRIPTION_STATE_CANCELED',
  ]);
  const active = activeStates.has(state || '') && expiresAt.getTime() > Date.now();

  if (active && subscription.acknowledgementState !== 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED') {
    try {
      const acknowledgementUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(
        STORE_PRODUCTS.google.packageName
      )}/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`;
      const acknowledgement = await fetch(acknowledgementUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: '{}',
        signal: AbortSignal.timeout(15_000),
      });
      if (!acknowledgement.ok) throw new Error('Google Play acknowledge failed');
    } catch {
      throw serviceUnavailable('Google Play purchase could not be acknowledged');
    }
  }

  const purchaseTokenHash = sha256(purchaseToken);
  return {
    store: 'google',
    productId,
    transactionKey: purchaseTokenHash,
    latestTransactionId: lineItem.latestSuccessfulOrderId || null,
    purchaseTokenHash,
    expiresAt,
    active,
    accountId: accountId || undefined,
    willRenew: state === 'SUBSCRIPTION_STATE_CANCELED'
      ? false
      : subscription.autoRenewingPlan?.autoRenewEnabled ?? null,
  };
};

export const verifyStorePurchase = async (
  store: 'apple' | 'google',
  productId: string,
  purchaseToken: string,
  accountToken: string
): Promise<VerifiedStorePurchase> => {
  if (!purchaseToken || purchaseToken.length > 20_000) {
    throw new BadRequestError('Purchase evidence is missing or invalid');
  }
  if (store === 'apple') {
    if (productId !== STORE_PRODUCTS.apple.productId) {
      throw new BadRequestError('Apple product is not recognized');
    }
    return verifyApplePurchase(purchaseToken, accountToken);
  }
  return verifyGooglePurchase(purchaseToken, productId, getGoogleObfuscatedAccountId(accountToken));
};

export const verifyGoogleNotificationPurchase = async (productId: string, purchaseToken: string) =>
  verifyGooglePurchase(purchaseToken, productId);
