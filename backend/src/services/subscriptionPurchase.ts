import { GoogleAuth } from 'google-auth-library';
import { Type } from '@apple/app-store-server-library';
import { createHash } from 'crypto';
import { applePurchaseClient } from './storePurchase';
import { AppError, BadRequestError } from '../utils/errors';
import { SubscriptionPlanKey, SubscriptionStore } from '../models/User';

type VerifiedSubscription = {
  transactionKey: string;
  active: boolean;
  expiresAt?: Date;
  autoRenewing?: boolean;
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new AppError('Store purchases are not configured', 503);
  return value;
}

function safeDate(value: unknown): Date | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function accountMatches(value: unknown, expected: string): boolean {
  if (!expected) return true;
  return typeof value !== 'string' || value.length === 0 || value === expected;
}

export async function googleSubscription(productId: string, proof: string, expectedAccount: string) {
  let credentials: Record<string, unknown>;
  try {
    credentials = JSON.parse(required('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON')) as Record<string, unknown>;
  } catch { throw new AppError('Google purchase configuration is invalid', 503); }
  const auth = new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/androidpublisher'] });
  const client = await auth.getClient();
  const packageName = required('GOOGLE_PLAY_PACKAGE_NAME');
  const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}`;
  const url = `${base}/purchases/subscriptionsv2/tokens/${encodeURIComponent(proof)}`;
  let response;
  try {
    response = await client.request<any>({ url, timeout: 15000 });
  } catch {
    throw new BadRequestError('Subscription could not be verified');
  }
  const purchase = response.data as {
    subscriptionState?: string;
    externalAccountIdentifiers?: { obfuscatedExternalAccountId?: string };
    lineItems?: Array<{ productId?: string; expiryTime?: string; autoRenewingPlan?: unknown }>;
  };
  const line = purchase.lineItems?.find((item) => item.productId === productId);
  if (!line || !accountMatches(purchase.externalAccountIdentifiers?.obfuscatedExternalAccountId, expectedAccount)) {
    throw new BadRequestError('Subscription is invalid or belongs to another account');
  }
  const expiresAt = safeDate(line.expiryTime);
  const activeState = purchase.subscriptionState === 'SUBSCRIPTION_STATE_ACTIVE' ||
    purchase.subscriptionState === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD';
  const active = activeState && Boolean(expiresAt && expiresAt.getTime() > Date.now());
  // Acknowledge a new subscription. A failed acknowledgement must not grant
  // access; the next restore/notification can retry it.
  if (active) {
    const acknowledgeUrl = `${base}/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(proof)}:acknowledge`;
    try { await client.request({ url: acknowledgeUrl, method: 'POST', data: {}, timeout: 15000 }); } catch { /* Already acknowledged is harmless. */ }
  }
  return { transactionKey: createHash('sha256').update(proof).digest('hex'), active, expiresAt,
    autoRenewing: Boolean(line.autoRenewingPlan) } satisfies VerifiedSubscription;
}

export async function appleSubscription(proof: string, productId: string, expectedAccount: string): Promise<VerifiedSubscription> {
  const { client, verifier, environment } = applePurchaseClient();
  let response;
  try { response = await client.getTransactionInfo(proof); }
  catch { throw new BadRequestError('Subscription could not be verified'); }
  if (!response.signedTransactionInfo) throw new BadRequestError('Subscription transaction not found');
  const transaction = await verifier.verifyAndDecodeTransaction(response.signedTransactionInfo);
  if (transaction.productId !== productId || transaction.type !== Type.AUTO_RENEWABLE_SUBSCRIPTION ||
      transaction.appAccountToken !== expectedAccount || !transaction.originalTransactionId) {
    throw new BadRequestError('Subscription is invalid or belongs to another account');
  }
  const expiresAt = safeDate(transaction.expiresDate);
  const active = transaction.revocationDate == null && Boolean(expiresAt && expiresAt.getTime() > Date.now());
  return { transactionKey: `${environment}:${transaction.originalTransactionId}`, active, expiresAt, autoRenewing: active };
}

export async function verifySubscriptionPurchase(
  store: SubscriptionStore, planKey: SubscriptionPlanKey, productId: string, proof: string, expectedAccount: string,
): Promise<VerifiedSubscription> {
  return store === 'android'
    ? googleSubscription(productId, proof, expectedAccount)
    : appleSubscription(proof, productId, expectedAccount);
}
