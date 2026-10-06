import { GoogleAuth } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { ProductState } from '../models/StoreProduct';

export interface ProvisioningInput {
  productId: string; title: string; description: string; priceInr: number; resourceId?: string;
  checkpoint: (resourceId: string) => Promise<void>;
}
export type ProvisioningResult = Pick<ProductState, 'status' | 'resourceId' | 'storeState'>;
export class ProvisioningError extends Error {
  constructor(public code: string, message: string) { super(message); }
}
function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new ProvisioningError('MISSING_CONFIGURATION', `${name} is required`);
  return value;
}
export function priceInPaise(value: number): number {
  const cents = Math.round(value * 100);
  if (!Number.isFinite(value) || value <= 0 || !Number.isSafeInteger(cents) || Math.abs(value * 100 - cents) > 0.00001) {
    throw new ProvisioningError('INVALID_PRICE', 'Initial price must be positive INR with at most two decimal places');
  }
  return cents;
}
function httpStatus(error: unknown): number | undefined {
  const e = error as { status?: number; response?: { status?: number } };
  return e?.status ?? e?.response?.status;
}
export function safeProvisioningError(error: unknown): string {
  if (error instanceof ProvisioningError) return `${error.code}: ${error.message}`;
  const status = httpStatus(error);
  if (status === 401 || status === 403) return 'STORE_AUTHORIZATION_FAILED: Check backend credentials and store permissions';
  if (status === 429) return 'STORE_RATE_LIMITED: Retry later';
  if (status) return `STORE_HTTP_${status}: Store rejected the request; check product configuration in the console`;
  // Provider errors can contain private keys, tokens, or request bodies.
  return 'STORE_REQUEST_FAILED: Check backend credentials, connectivity, and product configuration';
}

export async function provisionGoogle(input: ProvisioningInput): Promise<ProvisioningResult> {
  const price = priceInPaise(input.priceInr);
  const packageName = required('GOOGLE_PLAY_PACKAGE_NAME');
  let credentials;
  try {
    credentials = JSON.parse(required('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON'));
    if (!credentials.client_email || !credentials.private_key) throw new Error();
  } catch (error) {
    if (error instanceof ProvisioningError) throw error;
    throw new ProvisioningError('INVALID_CONFIGURATION', 'Google service-account JSON is invalid');
  }
  const client = await new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/androidpublisher'] }).getClient();
  const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}`;
  const suffix = encodeURIComponent(input.productId);
  const get = async () => (await client.request<any>({ url: `${base}/oneTimeProducts/${suffix}`, timeout: 15000 })).data;
  let product;
  try { product = await get(); } catch (error) { if (httpStatus(error) !== 404) throw error; }
  if (!product) {
    const version = required('GOOGLE_PLAY_REGIONS_VERSION');
    const data = {
      packageName, productId: input.productId,
      listings: [{ languageCode: 'en-US', title: input.title.slice(0, 55), description: input.description.slice(0, 200) || input.title.slice(0, 200) }],
      purchaseOptions: [{ purchaseOptionId: 'buy', buyOption: { legacyCompatible: true, multiQuantityEnabled: false },
        regionalPricingAndAvailabilityConfigs: [{ regionCode: 'IN', availability: 'AVAILABLE',
          price: { currencyCode: 'INR', units: String(Math.floor(price / 100)), nanos: (price % 100) * 10000000 } }] }],
    };
    // Only a missing product is configured. Existing prices are never patched.
    product = (await client.request<any>({ url: `${base}/onetimeproducts/${suffix}`, method: 'PATCH',
      params: { allowMissing: true, updateMask: 'listings,purchaseOptions', 'regionsVersion.version': version },
      data, timeout: 15000 })).data;
  }
  if (product.productId !== input.productId) throw new ProvisioningError('UNEXPECTED_PRODUCT', 'Google returned a different product');
  const option = product.purchaseOptions?.find((p: any) => p.purchaseOptionId === 'buy');
  if (!option?.buyOption || option.buyOption.multiQuantityEnabled || !option.buyOption.legacyCompatible ||
      !option.regionalPricingAndAvailabilityConfigs?.some((r: any) => r.regionCode === 'IN' && r.availability === 'AVAILABLE')) {
    throw new ProvisioningError('PRODUCT_CONFIGURATION_CONFLICT', 'Existing Google product requires manual purchase-option inspection');
  }
  if (option.state !== 'ACTIVE') {
    await client.request({ url: `${base}/oneTimeProducts/${suffix}/purchaseOptions:batchUpdateStates`, method: 'POST',
      data: { requests: [{ activatePurchaseOptionRequest: { packageName, productId: input.productId, purchaseOptionId: 'buy' } }] }, timeout: 15000 });
    product = await get();
  }
  const active = product.purchaseOptions?.some((p: any) => p.purchaseOptionId === 'buy' && p.state === 'ACTIVE');
  if (!active) throw new ProvisioningError('NOT_ACTIVE', 'Google activation has not propagated; retry later');
  return { status: 'ready', storeState: 'ACTIVE' };
}

type Resource = { id: string; type?: string; attributes?: Record<string, any> };
type AppleResponse = { data: any; links?: { next?: string } };
export function appleCatalogClient() {
  const key = required('APP_STORE_CONNECT_PRIVATE_KEY').replace(/\\n/g, '\n');
  const keyId = required('APP_STORE_CONNECT_KEY_ID');
  const issuer = required('APP_STORE_CONNECT_ISSUER_ID');
  const appId = required('APP_STORE_CONNECT_APP_ID');
  let token: string;
  try { token = jwt.sign({}, key, { algorithm: 'ES256', keyid: keyId, issuer, audience: 'appstoreconnect-v1', expiresIn: 1200 }); }
  catch { throw new ProvisioningError('INVALID_CONFIGURATION', 'App Store Connect signing key is invalid'); }
  const request = async (path: string, method = 'GET', body?: unknown): Promise<AppleResponse> => {
    const url = new URL(path, 'https://api.appstoreconnect.apple.com');
    if (url.origin !== 'https://api.appstoreconnect.apple.com') throw new ProvisioningError('INVALID_URL', 'Unexpected Apple pagination URL');
    const response = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw Object.assign(new Error('Apple API request failed'), { status: response.status });
    return await response.json() as AppleResponse;
  };
  return { request, appId };
}
async function all(request: ReturnType<typeof appleCatalogClient>['request'], path: string): Promise<Resource[]> {
  const result: Resource[] = [];
  for (let page = 0; path; page++) {
    if (page >= 50) throw new ProvisioningError('PAGINATION_LIMIT', 'Apple catalogue requires a smaller query');
    const response = await request(path);
    if (!Array.isArray(response.data)) throw new ProvisioningError('INVALID_RESPONSE', 'Apple returned an unexpected list');
    result.push(...response.data);
    path = response.links?.next || '';
  }
  return result;
}
const relationship = (type: string, id: string) => ({ data: { type, id } });

export async function provisionApple(input: ProvisioningInput): Promise<ProvisioningResult> {
  const cents = priceInPaise(input.priceInr);
  const { request, appId } = appleCatalogClient();
  let product: Resource | undefined;
  if (input.resourceId) product = (await request(`/v2/inAppPurchases/${encodeURIComponent(input.resourceId)}`)).data;
  else product = (await all(request, `/v1/apps/${encodeURIComponent(appId)}/inAppPurchasesV2?limit=200`))
    .find((p) => p.attributes?.productId === input.productId);
  if (!product) {
    product = (await request('/v2/inAppPurchases', 'POST', { data: { type: 'inAppPurchases',
      attributes: { name: `${input.title.slice(0, 39)} ${input.productId.slice(-24)}`, productId: input.productId, inAppPurchaseType: 'NON_CONSUMABLE',
        reviewNote: 'One-time access to this HappiNotes premium story book. Sign in and open the book to purchase.' },
      relationships: { app: relationship('apps', appId) } } })).data;
  }
  if (!product?.id || product.attributes?.productId !== input.productId || product.attributes?.inAppPurchaseType !== 'NON_CONSUMABLE') {
    throw new ProvisioningError('PRODUCT_CONFIGURATION_CONFLICT', 'Apple product identity or type does not match');
  }
  const id = product.id;
  // Persist immediately: a failure configuring metadata or price must not lose the management ID.
  await input.checkpoint(id);
  const path = `/v2/inAppPurchases/${encodeURIComponent(id)}`;
  const versions = await all(request, `${path}/versions?limit=200`);
  let version = versions.find((v) => v.attributes?.state === 'PREPARE_FOR_SUBMISSION');
  const approved = product.attributes?.state === 'APPROVED';
  // Do not create new versions while an existing version is being reviewed or is approved.
  if (!versions.length && !approved) version = (await request('/v1/inAppPurchaseVersions', 'POST', { data: {
    type: 'inAppPurchaseVersions', relationships: { inAppPurchase: relationship('inAppPurchases', id) } } })).data;
  if (version && !approved) {
    const localizations = await all(request, `/v1/inAppPurchaseVersions/${encodeURIComponent(version.id)}/localizations?limit=200`);
    if (!localizations.some((l) => l.attributes?.locale === 'en-US')) {
      await request('/v2/inAppPurchaseLocalizations', 'POST', { data: { type: 'inAppPurchaseLocalizations',
        attributes: { locale: 'en-US', name: input.title.slice(0, 30), description: input.description.slice(0, 45) || input.title.slice(0, 45) },
        relationships: { version: relationship('inAppPurchaseVersions', version.id) } } });
    }
  }
  let schedule;
  try { schedule = (await request(`${path}/iapPriceSchedule`)).data; }
  catch (error) { if (httpStatus(error) !== 404) throw error; }
  if (!schedule) {
    const points = await all(request, `${path}/pricePoints?filter%5Bterritory%5D=IND&limit=200`);
    const point = points.find((p) => Math.round(Number(p.attributes?.customerPrice) * 100) === cents);
    if (!point) throw new ProvisioningError('PRICE_POINT_UNAVAILABLE', 'No exact Apple INR price point; choose a supported amount before provisioning');
    await request('/v1/inAppPurchasePriceSchedules', 'POST', {
      data: { type: 'inAppPurchasePriceSchedules', relationships: {
        inAppPurchase: relationship('inAppPurchases', id), baseTerritory: relationship('territories', 'IND'),
        manualPrices: { data: [{ type: 'inAppPurchasePrices', id: '${initial-price}' }] } } },
      included: [{ type: 'inAppPurchasePrices', id: '${initial-price}', attributes: { startDate: null },
        relationships: { inAppPurchaseV2: relationship('inAppPurchases', id), inAppPurchasePricePoint: relationship('inAppPurchasePricePoints', point.id) } }],
    });
  }
  let availability;
  try { availability = (await request(`${path}/inAppPurchaseAvailability`)).data; }
  catch (error) { if (httpStatus(error) !== 404) throw error; }
  if (!availability) {
    await request('/v1/inAppPurchaseAvailabilities', 'POST', { data: { type: 'inAppPurchaseAvailabilities',
      attributes: { availableInNewTerritories: false }, relationships: {
        inAppPurchase: relationship('inAppPurchases', id), availableTerritories: { data: [{ type: 'territories', id: 'IND' }] } } } });
  }
  // Never fake approval or submit the first IAP without its required app binary/review assets.
  return { resourceId: id, status: approved ? 'ready' : 'awaiting_review',
    storeState: String(product.attributes?.state || versions[0]?.attributes?.state || 'PREPARE_FOR_SUBMISSION') };
}
