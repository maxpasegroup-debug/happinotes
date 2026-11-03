import appleTerritoryCodes from '../data/appleTerritoryCodes.json';
import { appleCatalogClient, ProvisioningError } from './storeProductProviders';

type MarketPrice = { regionCode: string; currencyCode: string; offerPrice: number };
type AppleResource = { id: string; type?: string; attributes?: Record<string, any>; relationships?: Record<string, any> };

async function all(request: ReturnType<typeof appleCatalogClient>['request'], path: string): Promise<AppleResource[]> {
  const result: AppleResource[] = [];
  for (let page = 0; path; page++) {
    if (page >= 30) throw new ProvisioningError('PAGINATION_LIMIT', 'Apple returned too many subscription records');
    const response = await request(path);
    if (!Array.isArray(response.data)) throw new ProvisioningError('INVALID_RESPONSE', 'Apple returned an unexpected subscription response');
    result.push(...response.data);
    path = response.links?.next || '';
  }
  return result;
}

function status(error: unknown): number | undefined {
  const value = error as { status?: number; response?: { status?: number } };
  return value?.status ?? value?.response?.status;
}

function territory(code: string): string {
  const value = (appleTerritoryCodes as Record<string, string>)[code];
  if (!value) throw new ProvisioningError('UNSUPPORTED_APPLE_TERRITORY', `Apple territory is not mapped for ${code}`);
  return value;
}

async function pricePoints(request: ReturnType<typeof appleCatalogClient>['request'], subscriptionId: string, territoryCode: string) {
  return all(request, `/v1/subscriptions/${encodeURIComponent(subscriptionId)}/pricePoints?filter%5Bterritory%5D=${encodeURIComponent(territoryCode)}&limit=200`);
}

async function currentPriceMatches(
  request: ReturnType<typeof appleCatalogClient>['request'], subscriptionId: string,
  territoryCode: string, amount: number,
): Promise<boolean> {
  const path = `/v1/subscriptions/${encodeURIComponent(subscriptionId)}/prices?filter%5Bterritory%5D=${encodeURIComponent(territoryCode)}&include=subscriptionPricePoint`;
  const response = await request(path) as { data?: AppleResource[]; included?: AppleResource[] };
  const included = response.included ?? [];
  const rows = Array.isArray(response.data) ? response.data : [];
  return rows.some((price: AppleResource) => {
    const pointId = price.relationships?.subscriptionPricePoint?.data?.id;
    const point = included.find((entry: AppleResource) => entry.id === pointId);
    return Math.abs(Number(point?.attributes?.customerPrice) - amount) < 0.000001;
  });
}

/** Schedule and verify Apple auto-renewable subscription prices per territory. */
export async function syncAppleSubscriptionPrices(input: {
  productId: string;
  markets: MarketPrice[];
}): Promise<void> {
  if (!input.markets.length) throw new ProvisioningError('NO_APPLE_MARKETS', 'No markets are enabled for Apple App Store');
  const { request, appId } = appleCatalogClient();
  const subscriptions = await all(request, `/v1/apps/${encodeURIComponent(appId)}/subscriptions?limit=200`);
  const subscription = subscriptions.find((item) => item.attributes?.productId === input.productId);
  if (!subscription) throw new ProvisioningError('APPLE_PRODUCT_NOT_FOUND', 'Create this auto-renewable subscription in App Store Connect before publishing');

  const errors: string[] = [];
  for (const market of input.markets) {
    let code: string;
    try { code = territory(market.regionCode); }
    catch (error) { errors.push(error instanceof Error ? error.message : `Unsupported Apple territory ${market.regionCode}`); continue; }
    try {
      const points = await pricePoints(request, subscription.id, code);
      const point = points.find((item) => Math.abs(Number(item.attributes?.customerPrice) - market.offerPrice) < 0.000001);
      if (!point) throw new ProvisioningError('APPLE_PRICE_POINT_UNAVAILABLE', `No exact ${market.currencyCode} price point for ${market.regionCode}`);
      try {
        await request('/v1/subscriptionPrices', 'POST', { data: {
          type: 'subscriptionPrices',
          attributes: { startDate: null, preserveCurrentPrice: true },
          relationships: {
            subscription: { data: { type: 'subscriptions', id: subscription.id } },
            subscriptionPricePoint: { data: { type: 'subscriptionPricePoints', id: point.id } },
          },
        } });
      } catch (error) {
        // A duplicate/current price can be rejected by ASC; accept only if the
        // authoritative price list confirms the requested value is already set.
        if (!(await currentPriceMatches(request, subscription.id, code, market.offerPrice))) throw error;
      }
      if (!(await currentPriceMatches(request, subscription.id, code, market.offerPrice))) {
        throw new ProvisioningError('APPLE_PRICE_NOT_CONFIRMED', `Apple did not confirm ${market.regionCode} at ${market.currencyCode} ${market.offerPrice}`);
      }
    } catch (error) {
      const providerStatus = status(error);
      errors.push(error instanceof ProvisioningError ? error.message : providerStatus === 401 || providerStatus === 403
        ? `Apple authorization failed for ${market.regionCode}; check App Store Connect API key permissions`
        : providerStatus === 429 ? `Apple rate limited ${market.regionCode}; retry publishing`
        : `Apple rejected ${market.regionCode}; verify the subscription, territory, and price point`);
    }
  }
  if (errors.length) throw new ProvisioningError('APPLE_PARTIAL_SYNC', errors.join('; '));
}
