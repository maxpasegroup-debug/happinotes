import { SubscriptionPlan, SubscriptionPlanKey } from '../models/SubscriptionPlan';
import { exposeSubscriptionStoreProductIds } from './subscriptionProductMapping';

const defaults: Array<{
  key: SubscriptionPlanKey;
  productId: string;
  storeProductIds: { android: string; ios?: string };
  billingPeriod: 'P1M' | 'P1Y';
}> = [
  {
    key: 'monthly',
    productId: process.env.GOOGLE_PLAY_SUBSCRIPTION_MONTHLY_PRODUCT_ID?.trim() || 'happinotes_premium_monthly',
    storeProductIds: {
      android: process.env.GOOGLE_PLAY_SUBSCRIPTION_MONTHLY_PRODUCT_ID?.trim() || 'happinotes_premium_monthly',
      ios: process.env.APPLE_IAP_SUBSCRIPTION_MONTHLY_PRODUCT_ID?.trim() || undefined,
    },
    billingPeriod: 'P1M',
  },
  {
    key: 'yearly',
    productId: process.env.GOOGLE_PLAY_SUBSCRIPTION_YEARLY_PRODUCT_ID?.trim() || 'happinotes_premium_yearly',
    storeProductIds: {
      android: process.env.GOOGLE_PLAY_SUBSCRIPTION_YEARLY_PRODUCT_ID?.trim() || 'happinotes_premium_yearly',
      ios: process.env.APPLE_IAP_SUBSCRIPTION_YEARLY_PRODUCT_ID?.trim() || undefined,
    },
    billingPeriod: 'P1Y',
  },
];

export async function ensureSubscriptionPlans() {
  for (const plan of defaults) {
    await SubscriptionPlan.updateOne(
      { key: plan.key },
      { $setOnInsert: {
        ...plan,
        priceInr: plan.key === 'monthly' ? 699 : 0,
        pricingDefaultsVersion: plan.key === 'monthly' ? 1 : 0,
        regionalPricing: plan.key === 'monthly' ? [{
          regionCode: 'IN',
          currencyCode: 'INR',
          regularPrice: 1999,
          offerPrice: 699,
          googlePlayAvailable: false,
          appleAppStoreAvailable: false,
        }] : [],
        active: true,
      } },
      { upsert: true },
    );
  }
  // One-time migration for monthly plans created before country pricing.
  // Admin changes made after this seed remain untouched.
  const monthly = await SubscriptionPlan.findOne({ key: 'monthly' });
  if (monthly && (monthly.pricingDefaultsVersion ?? 0) < 1) {
    const india = monthly.regionalPricing.find((row) => row.regionCode === 'IN');
    if (india) {
      india.currencyCode = 'INR';
      india.regularPrice = 1999;
      india.offerPrice = 699;
    } else {
      monthly.regionalPricing.push({
        regionCode: 'IN', currencyCode: 'INR', regularPrice: 1999, offerPrice: 699,
        googlePlayAvailable: false, appleAppStoreAvailable: false,
      });
    }
    monthly.priceInr = 699;
    monthly.pricingDefaultsVersion = 1;
    await monthly.save();
  }
  const plans = await SubscriptionPlan.find({ key: { $in: defaults.map((plan) => plan.key) } })
    .sort({ key: 1 })
    .lean();
  return plans.map((plan) => exposeSubscriptionStoreProductIds(plan));
}

export async function getSubscriptionPlan(key: SubscriptionPlanKey) {
  await ensureSubscriptionPlans();
  return SubscriptionPlan.findOne({ key });
}
