import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware';
import { AppError, BadRequestError, NotFoundError } from '../utils/errors';
import { ensureSubscriptionPlans } from '../services/subscriptionPlans';
import { SubscriptionPlan, SubscriptionPlanKey } from '../models/SubscriptionPlan';
import { syncGoogleSubscriptionPlan } from '../services/googleSubscriptionCatalog';
import { emitSubscriptionPlansChanged } from '../services/realtime';
import { exposeSubscriptionStoreProductIds } from '../services/subscriptionProductMapping';
import { syncAppleSubscriptionPrices } from '../services/appleSubscriptionCatalog';

const router = Router();
router.use(authenticate, requireAdmin);

router.get('/', async (_req, res, next) => {
  try {
    res.json({ success: true, plans: await ensureSubscriptionPlans() });
  } catch (error) { next(error); }
});

// Publish one store at a time. The active product mapping and price version
// change only after that store confirms every configured market price.
router.post('/:key/publish/:store', async (req, res, next) => {
  try {
    const key = req.params.key as SubscriptionPlanKey;
    const store = req.params.store;
    if (key !== 'monthly' && key !== 'yearly') throw new BadRequestError('Plan must be monthly or yearly');
    if (store !== 'android' && store !== 'ios') throw new BadRequestError('Store must be android or ios');
    const rows = req.body?.regionalPricing;
    const productId = typeof req.body?.productId === 'string' ? req.body.productId.trim() : '';
    if (!Array.isArray(rows) || rows.length === 0) throw new BadRequestError('Add at least one market before publishing');
    const seen = new Set<string>();
    for (const row of rows) {
      if (!row || typeof row.regionCode !== 'string' || !/^[A-Z]{2}$/.test(row.regionCode) || seen.has(row.regionCode) ||
          typeof row.currencyCode !== 'string' || !/^[A-Z]{3}$/.test(row.currencyCode) ||
          typeof row.regularPrice !== 'number' || !Number.isFinite(row.regularPrice) || row.regularPrice <= 0 ||
          typeof row.offerPrice !== 'number' || !Number.isFinite(row.offerPrice) || row.offerPrice <= 0 ||
          row.offerPrice > row.regularPrice || Math.round(row.regularPrice * 100) !== row.regularPrice * 100 ||
          Math.round(row.offerPrice * 100) !== row.offerPrice * 100 ||
          typeof row.googlePlayAvailable !== 'boolean' || typeof row.appleAppStoreAvailable !== 'boolean') {
        throw new BadRequestError('Check each market, currency, price, and store availability flag');
      }
      seen.add(row.regionCode);
    }
    const markets = rows.filter((row: any) => store === 'android' ? row.googlePlayAvailable : row.appleAppStoreAvailable)
      .map((row: any) => ({ regionCode: row.regionCode, currencyCode: row.currencyCode, offerPrice: row.offerPrice }));
    if (!markets.length) throw new BadRequestError(`Enable ${store === 'android' ? 'Google Play' : 'Apple App Store'} for at least one market`);

    await ensureSubscriptionPlans();
    const plan = await SubscriptionPlan.findOne({ key });
    if (!plan) throw new NotFoundError('Subscription plan not found');
    const currentPrices = (plan.regionalPricing ?? []).map(({ regionCode, currencyCode, regularPrice, offerPrice }) =>
      ({ regionCode, currencyCode, regularPrice, offerPrice })).sort((a, b) => a.regionCode.localeCompare(b.regionCode));
    const nextPrices = rows.map(({ regionCode, currencyCode, regularPrice, offerPrice }: any) =>
      ({ regionCode, currencyCode, regularPrice, offerPrice })).sort((a: any, b: any) => a.regionCode.localeCompare(b.regionCode));
    const priceInr = rows.find((row: any) => row.regionCode === 'IN')?.offerPrice ?? plan.priceInr;
    const pricesChanged = JSON.stringify(currentPrices) !== JSON.stringify(nextPrices) || priceInr !== plan.priceInr;
    const currentIds = exposeSubscriptionStoreProductIds(plan.toObject()).storeProductIds;
    const targetId = productId || currentIds[store] || '';
    if (!targetId) throw new BadRequestError(`Enter a ${store === 'android' ? 'Google Play' : 'Apple'} product ID`);
    const currentVersion = plan.priceVersion ?? 1;
    const currentStoreVersion = plan.storePriceVersions?.[store] ??
      (plan.priceVersionHistory ?? []).find((entry: any) => entry.storeProductIds?.[store] === currentIds[store])?.version ?? currentVersion;
    const previousStoreSnapshot = (plan.priceVersionHistory ?? []).find((entry: any) => entry.version === currentStoreVersion);
    const storeNeedsNewProduct = pricesChanged || (currentStoreVersion < currentVersion &&
      previousStoreSnapshot && JSON.stringify(previousStoreSnapshot.regionalPricing ?? []) !== JSON.stringify(nextPrices));
    if (storeNeedsNewProduct && targetId === currentIds[store]) {
      throw new BadRequestError('A new product ID is required for a changed price so existing subscribers keep their price');
    }
    const usedIds = (plan.priceVersionHistory ?? []).map((entry: any) => entry.storeProductIds?.[store]).filter(Boolean);
    if (targetId !== currentIds[store] && usedIds.includes(targetId)) {
      throw new BadRequestError('This product ID belongs to an archived price version; choose a new product ID');
    }
    const targetVersion = pricesChanged ? currentVersion + 1 : currentVersion;
    try {
      if (store === 'android') {
        await syncGoogleSubscriptionPlan({ productId: targetId, basePlanId: key,
          billingPeriod: plan.billingPeriod, priceInr,
          regionalPricing: markets });
      } else {
        await syncAppleSubscriptionPrices({ productId: targetId, markets });
      }
    } catch (error) {
      const code = (error as { code?: string })?.code;
      const message = error instanceof AppError || error instanceof Error ? error.message : 'Store rejected the update';
      const status = code === 'APPLE_PARTIAL_SYNC' ? 'partial' : 'failed';
      await SubscriptionPlan.updateOne({ key }, { $set: {
        [`storeSyncStatus.${store}`]: { version: targetVersion, status, message, updatedAt: new Date() },
      } });
      res.json({ success: false, store, plan: await SubscriptionPlan.findOne({ key }).lean(),
        storeStatus: { version: targetVersion, status, message } });
      return;
    }

    const update: Record<string, unknown> = {
      [`storeProductIds.${store}`]: targetId,
      [`storePriceVersions.${store}`]: targetVersion,
      [`storeSyncStatus.${store}`]: { version: targetVersion, status: 'live', updatedAt: new Date() },
    };
    const operation: Record<string, unknown> = { $set: update };
    if (!pricesChanged && targetId !== currentIds[store] && currentIds[store]) {
      operation.$push = { priceVersionHistory: { version: currentStoreVersion,
        storeProductIds: { [store]: currentIds[store] }, priceInr: plan.priceInr,
        regionalPricing: currentPrices, publishedAt: new Date() } };
    }
    if (pricesChanged) {
      operation.$push = { priceVersionHistory: { version: plan.priceVersion ?? 1,
        storeProductIds: currentIds, priceInr: plan.priceInr, regionalPricing: currentPrices, publishedAt: new Date() } };
      const otherStore = store === 'android' ? 'ios' : 'android';
      const otherStoreVersion = plan.storePriceVersions?.[otherStore] ?? currentVersion;
      Object.assign(update, { priceVersion: targetVersion, regionalPricing: rows, priceInr,
        [`storePriceVersions.${otherStore}`]: otherStoreVersion });
      // The other store still has its previous price until its own publish succeeds.
    }
    await SubscriptionPlan.updateOne({ key }, operation, { runValidators: true });
    emitSubscriptionPlansChanged(key);
    res.json({ success: true, store, plan: await SubscriptionPlan.findOne({ key }).lean(),
      storeStatus: { version: targetVersion, status: 'live' } });
  } catch (error) { next(error); }
});

export default router;
