import { SubscriptionPlan, SubscriptionPlanKey } from '../models/SubscriptionPlan';

const defaults: Array<{
  key: SubscriptionPlanKey;
  productId: string;
  billingPeriod: 'P1M' | 'P1Y';
}> = [
  {
    key: 'monthly',
    productId: process.env.GOOGLE_PLAY_SUBSCRIPTION_MONTHLY_PRODUCT_ID?.trim() || 'happinotes_premium_monthly',
    billingPeriod: 'P1M',
  },
  {
    key: 'yearly',
    productId: process.env.GOOGLE_PLAY_SUBSCRIPTION_YEARLY_PRODUCT_ID?.trim() || 'happinotes_premium_yearly',
    billingPeriod: 'P1Y',
  },
];

export async function ensureSubscriptionPlans() {
  for (const plan of defaults) {
    await SubscriptionPlan.updateOne(
      { key: plan.key },
      { $setOnInsert: { ...plan, priceInr: 0, active: true } },
      { upsert: true },
    );
  }
  return SubscriptionPlan.find({ key: { $in: defaults.map((plan) => plan.key) } })
    .sort({ key: 1 })
    .lean();
}

export async function getSubscriptionPlan(key: SubscriptionPlanKey) {
  await ensureSubscriptionPlans();
  return SubscriptionPlan.findOne({ key });
}
