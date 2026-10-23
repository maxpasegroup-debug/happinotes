import { GoogleAuth } from 'google-auth-library';
import { Type } from '@apple/app-store-server-library';
import { createHash } from 'crypto';
import { applePurchaseClient } from './storePurchase';
import { AppError, BadRequestError } from '../utils/errors';
import { SubscriptionPlanKey, SubscriptionStore } from '../models/User';

export type VerifiedSubscription = {
  transactionKey: string;
  active: boolean;
  expiresAt?: Date;
  autoRenewing?: boolean;
};

export type VerifiedGoogleSubscriptionNotification = VerifiedSubscription & {
  externalAccountId?: string;
};

type GoogleSubscriptionPurchase = {
  subscriptionState?: string;
  acknowledgementState?: string;
  externalAccountIdentifiers?: { obfuscatedExternalAccountId?: unknown };
  lineItems?: Array<{ productId?: string; expiryTime?: string; autoRenewingPlan?: { autoRenewEnabled?: unknown } }>;
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

function accountMatches(value: unknown, expected: string, allowUnboundAccount: boolean): boolean {
  if (!expected) return false;
  if (typeof value === 'string' && value.length > 0) return value === expected;
  // A missing/malformed Play account identifier is accepted only for an
  // explicit restore of a transaction already claimed by this same user.
  return allowUnboundAccount;
}

function alreadyAcknowledged(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; status?: unknown; response?: { status?: unknown }; message?: unknown };
  const status = candidate.status ?? candidate.response?.status;
  if (candidate.code === 'ALREADY_ACKNOWLEDGED') return true;
  // Google uses HTTP 409 for the idempotent already-acknowledged response.
  // Do not treat arbitrary 4xx/5xx messages as acknowledgement success.
  if (Number(status) === 409 || Number(candidate.code) === 409) return true;
  // A message string alone is not an authenticated outcome. Providers and
  // proxies may reuse that wording for unrelated failures.
  return false;
}

export function subscriptionTransactionKey(proof: string): string {
  return createHash('sha256').update(proof).digest('hex');
}

async function fetchGoogleSubscription(productId: string, proof: string, fromNotification = false) {
  let credentials: Record<string, unknown>;
  try {
    credentials = JSON.parse(required('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON')) as Record<string, unknown>;
  } catch { throw new AppError('Google purchase configuration is invalid', 503); }
  if (!credentials || Array.isArray(credentials) || typeof credentials !== 'object') {
    throw new AppError('Google purchase configuration is invalid', 503);
  }
  const auth = new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/androidpublisher'] });
  const client = await auth.getClient();
  const packageName = required('GOOGLE_PLAY_PACKAGE_NAME');
  const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}`;
  const url = `${base}/purchases/subscriptionsv2/tokens/${encodeURIComponent(proof)}`;
  let response;
  try {
    response = await client.request<GoogleSubscriptionPurchase>({ url, timeout: 15000 });
  } catch {
    throw fromNotification
      ? new AppError('Store notification provider lookup failed; please retry.', 503)
      : new BadRequestError('Subscription could not be verified');
  }
  const purchase = response.data;
  const line = purchase.lineItems?.find((item) => item.productId === productId);
  if (!line) throw new BadRequestError('Subscription product does not match the verified purchase');
  return { client, base, purchase, line };
}

function activeGoogleState(state: unknown, expiresAt: Date | undefined): boolean {
  if (!expiresAt || expiresAt.getTime() <= Date.now()) return false;
  // CANCELED subscriptions remain entitled until their authoritative expiry.
  // Grace period remains entitled; hold, pause, expired, pending and revoked
  // states do not.
  return state === 'SUBSCRIPTION_STATE_ACTIVE' ||
    state === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD' ||
    state === 'SUBSCRIPTION_STATE_CANCELED';
}

function googleAutoRenewing(
  state: unknown,
  line: { autoRenewingPlan?: { autoRenewEnabled?: unknown } },
  active: boolean,
): boolean {
  return active && state !== 'SUBSCRIPTION_STATE_CANCELED' &&
    line.autoRenewingPlan?.autoRenewEnabled === true;
}

async function acknowledgeGoogleSubscription(
  client: { request: (request: { url: string; method: string; data: object; timeout: number }) => Promise<unknown> },
  base: string,
  productId: string,
  proof: string,
): Promise<void> {
  const acknowledgeUrl = `${base}/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(proof)}:acknowledge`;
  try {
    await client.request({ url: acknowledgeUrl, method: 'POST', data: {}, timeout: 15000 });
  } catch (error) {
    if (!alreadyAcknowledged(error)) {
      throw new AppError('Subscription acknowledgement failed; please retry.', 503);
    }
  }
}

export async function googleSubscription(
  productId: string,
  proof: string,
  expectedAccount: string,
  options: { allowUnboundAccount?: boolean } = {},
) {
  const { client, base, purchase, line } = await fetchGoogleSubscription(productId, proof);
  if (!accountMatches(
    purchase.externalAccountIdentifiers?.obfuscatedExternalAccountId,
    expectedAccount,
    options.allowUnboundAccount === true,
  )) {
    throw new BadRequestError('Subscription is invalid or belongs to another account');
  }
  const expiresAt = safeDate(line.expiryTime);
  const active = activeGoogleState(purchase.subscriptionState, expiresAt);
  // Acknowledge a new subscription. Already-acknowledged purchases are an
  // explicit idempotent success; every other failure blocks entitlement.
  if (active && purchase.acknowledgementState !== 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED') {
    await acknowledgeGoogleSubscription(client, base, productId, proof);
  }
  return { transactionKey: subscriptionTransactionKey(proof), active, expiresAt,
    autoRenewing: googleAutoRenewing(purchase.subscriptionState, line, active) } satisfies VerifiedSubscription;
}

/**
 * Verify a trusted Google RTDN token without inventing an account claim.
 * The route must resolve the returned transaction key to an existing ledger
 * record and compare externalAccountId with that record's owner before any
 * entitlement update is allowed.
 */
export async function googleSubscriptionNotification(
  productId: string,
  proof: string,
): Promise<VerifiedGoogleSubscriptionNotification> {
  const { client, base, purchase, line } = await fetchGoogleSubscription(productId, proof, true);
  const expiresAt = safeDate(line.expiryTime);
  const active = activeGoogleState(purchase.subscriptionState, expiresAt);
  if (active && purchase.acknowledgementState !== 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED') {
    await acknowledgeGoogleSubscription(client, base, productId, proof);
  }
  const rawExternalId = purchase.externalAccountIdentifiers?.obfuscatedExternalAccountId;
  return {
    transactionKey: subscriptionTransactionKey(proof),
    active,
    expiresAt,
    autoRenewing: googleAutoRenewing(purchase.subscriptionState, line, active),
    externalAccountId: typeof rawExternalId === 'string' && rawExternalId.length > 0 ? rawExternalId : undefined,
  };
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
  options: { allowUnboundAccount?: boolean } = {},
): Promise<VerifiedSubscription> {
  return store === 'android'
    ? googleSubscription(productId, proof, expectedAccount, options)
    : appleSubscription(proof, productId, expectedAccount);
}
