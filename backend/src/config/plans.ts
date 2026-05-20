import { env } from './env';

export type PlanId = 'monthly' | 'yearly' | 'lifetime';

export type SubscriptionPlan = {
  id: PlanId;
  name: string;
  price: number;
  durationDays: number;
  razorpayPlanId?: string;
};

export const PLANS: Record<PlanId, SubscriptionPlan> = {
  monthly: {
    id: 'monthly',
    name: 'Premium Monthly',
    price: 299,
    durationDays: 30,
    razorpayPlanId: env.RAZORPAY_MONTHLY_PLAN_ID,
  },
  yearly: {
    id: 'yearly',
    name: 'Premium Yearly',
    price: 1999,
    durationDays: 365,
    razorpayPlanId: env.RAZORPAY_YEARLY_PLAN_ID,
  },
  lifetime: {
    id: 'lifetime',
    name: 'Lifetime Access',
    price: 4999,
    durationDays: 36500,
  },
};

export const getPlan = (planId: string) => {
  return PLANS[planId as PlanId] || null;
};
