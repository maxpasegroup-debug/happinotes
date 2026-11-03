import { GoogleAuth } from 'google-auth-library';
import { AppError, BadRequestError } from '../utils/errors';

type PlanInput = {
  productId: string;
  basePlanId: string;
  billingPeriod: 'P1M' | 'P1Y';
  priceInr: number;
  regionalPricing?: Array<{ regionCode: string; currencyCode: string; offerPrice: number }>;
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new AppError(`${name} is not configured`, 503);
  return value;
}

function statusOf(error: unknown): number | undefined {
  const value = error as { status?: number; response?: { status?: number } };
  return value?.status ?? value?.response?.status;
}

function money(currencyCode: string, amount: number) {
  const nanos = Math.round(amount * 1000000000);
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isSafeInteger(nanos)) {
    throw new BadRequestError('Subscription price must be a positive INR amount');
  }
  const units = Math.floor(nanos / 1000000000);
  return { currencyCode, units: String(units), nanos: nanos - units * 1000000000 };
}

function planBody(input: PlanInput, packageName: string) {
  return {
    packageName,
    productId: input.productId,
    listings: [{
      languageCode: 'en-US',
      title: input.basePlanId === 'yearly' ? 'HappiNotes Premium Yearly' : 'HappiNotes Premium Monthly',
      description: 'Unlock every premium story in HappiNotes.',
      benefits: ['Unlimited premium stories', 'New episodes as they are released'],
    }],
    basePlans: [{
      basePlanId: input.basePlanId,
      autoRenewingBasePlanType: { billingPeriodDuration: input.billingPeriod },
      regionalConfigs: input.regionalPricing?.length
        ? input.regionalPricing.map((row) => ({ regionCode: row.regionCode, newSubscriberAvailability: true,
          price: money(row.currencyCode, row.offerPrice) }))
        : [{ regionCode: 'IN', newSubscriberAvailability: true, price: money('INR', input.priceInr) }],
    }],
  };
}

/**
 * Creates a missing Play subscription and keeps its base plan price/listing in
 * sync. Credentials stay on the backend; the mobile app only receives the SKU.
 */
export async function syncGoogleSubscriptionPlan(input: PlanInput): Promise<void> {
  const packageName = required('GOOGLE_PLAY_PACKAGE_NAME');
  const regionsVersion = required('GOOGLE_PLAY_REGIONS_VERSION');
  let credentials: Record<string, unknown>;
  try {
    credentials = JSON.parse(required('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON')) as Record<string, unknown>;
    if (typeof credentials.client_email !== 'string' || typeof credentials.private_key !== 'string') throw new Error();
  } catch {
    throw new AppError('Google Play service-account JSON is invalid', 503);
  }
  const client = await new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  }).getClient();
  const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}`;
  const path = `${base}/subscriptions/${encodeURIComponent(input.productId)}`;
  const body = planBody(input, packageName);
  let product: any;
  try {
    product = (await client.request<any>({ url: path, timeout: 15000 })).data;
  } catch (error) {
    if (statusOf(error) !== 404) throw new AppError('Google Play subscription lookup failed', 503);
  }

  if (!product) {
    try {
      product = (await client.request<any>({
        url: path,
        method: 'PATCH',
        params: {
          allowMissing: true,
          updateMask: 'listings,basePlans',
          'regionsVersion.version': regionsVersion,
        },
        data: body,
        timeout: 15000,
      })).data;
    } catch {
      throw new AppError('Google Play subscription could not be created', 503);
    }
  } else {
    const existing = Array.isArray(product.basePlans)
      ? product.basePlans.find((plan: any) => plan.basePlanId === input.basePlanId)
      : undefined;
    if (!existing) {
      try {
        product = (await client.request<any>({
          url: path,
          method: 'PATCH',
          params: {
            updateMask: 'listings,basePlans',
            'regionsVersion.version': regionsVersion,
          },
          data: { ...body, basePlans: [...(product.basePlans ?? []), ...body.basePlans] },
          timeout: 15000,
        })).data;
      } catch {
        throw new AppError('Google Play subscription base plan could not be created', 503);
      }
    } else {
      const desired = body.basePlans[0].regionalConfigs;
      const currentConfigs = existing.regionalConfigs ?? [];
      const matches = desired.length === currentConfigs.length && desired.every((want) => {
        const actual = currentConfigs.find((row: any) => row.regionCode === want.regionCode);
        return actual?.newSubscriberAvailability === true && actual?.price?.currencyCode === want.price.currencyCode &&
          Number(actual?.price?.units ?? 0) + Number(actual?.price?.nanos ?? 0) / 1000000000 ===
          Number(want.price.units) + want.price.nanos / 1000000000;
      });
      if (!matches) {
        try {
          product = (await client.request<any>({
            url: path,
            method: 'PATCH',
            params: {
              updateMask: 'basePlans',
              'regionsVersion.version': regionsVersion,
            },
            data: { ...body, basePlans: body.basePlans },
            timeout: 15000,
          })).data;
        } catch {
          throw new AppError('Google Play subscription price could not be updated', 503);
        }
      }
    }
  }

  const basePlan = product?.basePlans?.find((plan: any) => plan.basePlanId === input.basePlanId);
  if (!basePlan) throw new AppError('Google Play subscription base plan was not returned', 503);
  if (basePlan.state !== 'ACTIVE') {
    try {
      await client.request({
        url: `${path}/basePlans/${encodeURIComponent(input.basePlanId)}:activate`,
        method: 'POST',
        data: { packageName, productId: input.productId, basePlanId: input.basePlanId },
        timeout: 15000,
      });
    } catch {
      throw new AppError('Google Play subscription base plan could not be activated', 503);
    }
  }
  let verified: any;
  try { verified = (await client.request<any>({ url: path, timeout: 15000 })).data; }
  catch { throw new AppError('Google Play price publication could not be confirmed', 503); }
  const live = verified.basePlans?.find((candidate: any) => candidate.basePlanId === input.basePlanId);
  const targetConfigs = body.basePlans[0].regionalConfigs;
  if (live?.state !== 'ACTIVE' || !targetConfigs.every((target) => {
    const actual = live.regionalConfigs?.find((row: any) => row.regionCode === target.regionCode);
    return actual?.newSubscriberAvailability === true && actual?.price?.currencyCode === target.price.currencyCode &&
      Number(actual?.price?.units ?? 0) + Number(actual?.price?.nanos ?? 0) / 1000000000 ===
      Number(target.price.units) + target.price.nanos / 1000000000;
  })) throw new AppError('Google Play did not confirm every selected market price', 503);
}
