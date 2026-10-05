import { createHash } from 'crypto';
import { GoogleAuth } from 'google-auth-library';
import { AppStoreServerAPIClient, Environment, SignedDataVerifier, Type } from '@apple/app-store-server-library';
import { BadRequestError, AppError } from '../utils/errors';

export type Store = 'android' | 'ios';
export type ProductMapping = Record<string, Partial<Record<Store, string>>>;

// Configuration is server-owned: a client cannot choose which book a SKU unlocks.
export function productMapping(): ProductMapping {
  const mapping: unknown = JSON.parse(process.env.IAP_PRODUCTS_JSON || '{}');
  if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) {
    throw new AppError('Invalid purchase product configuration');
  }
  const seen = new Set<string>();
  for (const [bookId, products] of Object.entries(mapping)) {
    if (!/^[a-f\d]{24}$/i.test(bookId) || !products || typeof products !== 'object') {
      throw new AppError('Invalid purchase product configuration');
    }
    for (const store of ['android', 'ios'] as const) {
      const id = (products as Partial<Record<Store, unknown>>)[store];
      if (id === undefined) continue;
      if (typeof id !== 'string' || !id.trim() || seen.has(`${store}:${id}`)) {
        throw new AppError('Invalid or duplicate purchase product configuration');
      }
      seen.add(`${store}:${id}`);
    }
  }
  return mapping as ProductMapping;
}

export function accountToken(userId: string): string {
  const hash = createHash('sha256').update(`happinotes-iap:${userId}`).digest('hex');
  // A deterministic UUID shared by StoreKit appAccountToken and Play's account ID.
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new AppError('Store purchases are not configured', 503);
  return value;
}

export function applePurchaseClient() {
  const configuredEnvironment = required('APPLE_IAP_ENVIRONMENT');
  if (!['Production', 'Sandbox'].includes(configuredEnvironment)) {
    throw new AppError('Invalid Apple purchase environment', 503);
  }
  const environment = configuredEnvironment === 'Production' ? Environment.PRODUCTION : Environment.SANDBOX;
  const bundleId = required('APPLE_BUNDLE_ID');
  const appAppleId = environment === Environment.PRODUCTION ? Number(required('APPLE_APP_ID')) : undefined;
  const roots = (JSON.parse(required('APPLE_ROOT_CERTIFICATES_JSON')) as string[])
    .map((certificate) => Buffer.from(certificate, 'base64'));
  return {
    client: new AppStoreServerAPIClient(
      required('APPLE_IAP_PRIVATE_KEY').replace(/\\n/g, '\n'), required('APPLE_IAP_KEY_ID'),
      required('APPLE_IAP_ISSUER_ID'), bundleId, environment,
    ),
    verifier: new SignedDataVerifier(roots, true, environment, bundleId, appAppleId),
    environment,
  };
}

export async function googlePurchase(productId: string, proof: string) {
  const credentials = JSON.parse(required('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON'));
  const auth = new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/androidpublisher'] });
  const client = await auth.getClient();
  const packageName = required('GOOGLE_PLAY_PACKAGE_NAME');
  const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(proof)}`;
  const response = await client.request<{
    purchaseState?: number; acknowledgementState?: number;
    consumptionState?: number; obfuscatedExternalAccountId?: string;
  }>({ url: base, timeout: 15000 });
  return { client, base, purchase: response.data };
}

export async function verifyStorePurchase(
  store: Store, productId: string, proof: string, expectedAccount: string,
): Promise<{ transactionKey: string }> {
  if (store === 'android') {
    const { client, base, purchase } = await googlePurchase(productId, proof);
    if (purchase.purchaseState !== 0 || purchase.consumptionState !== 0 ||
        purchase.obfuscatedExternalAccountId !== expectedAccount) {
      throw new BadRequestError('Purchase is pending, invalid, or belongs to another account');
    }
    if (purchase.acknowledgementState !== 1) {
      await client.request({ url: `${base}:acknowledge`, method: 'POST', data: {}, timeout: 15000 });
    }
    // Never store raw purchase tokens in the purchase ledger.
    return { transactionKey: createHash('sha256').update(proof).digest('hex') };
  }

  const { client, verifier, environment } = applePurchaseClient();
  // Retrieve current store state instead of trusting a client-supplied old receipt.
  const response = await client.getTransactionInfo(proof);
  if (!response.signedTransactionInfo) throw new BadRequestError('Transaction not found');
  const transaction = await verifier.verifyAndDecodeTransaction(response.signedTransactionInfo);
  if (transaction.productId !== productId || transaction.type !== Type.NON_CONSUMABLE ||
      transaction.revocationDate != null || transaction.appAccountToken !== expectedAccount ||
      !transaction.originalTransactionId) {
    throw new BadRequestError('Purchase is invalid, refunded, or belongs to another account');
  }
  return { transactionKey: `${environment}:${transaction.originalTransactionId}` };
}
