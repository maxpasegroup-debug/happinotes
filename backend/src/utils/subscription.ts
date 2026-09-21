import type { IUser } from '../models/User';

const DEFAULT_SUBSCRIPTION_DAYS = 30;
export type SubscriptionPlan = 'monthly' | 'yearly';

export function parseSubscriptionPlan(value: unknown): SubscriptionPlan | null {
  const plan = String(value ?? '').trim().toLowerCase();
  return plan === 'monthly' || plan === 'yearly' ? plan : null;
}

export function subscriptionDays(plan: SubscriptionPlan): number {
  return plan === 'yearly' ? 365 : DEFAULT_SUBSCRIPTION_DAYS;
}

/**
 * Subscription is active when:
 * subscriptionActive === true AND
 * (subscriptionExpiry is null OR subscriptionExpiry > now)
 */
export function hasActiveSubscription(user: IUser | null | undefined): boolean {
  if (!user) return false;
  if (!user.subscriptionActive) return false;
  if (user.subscriptionExpiry == null) return true;
  return user.subscriptionExpiry > new Date();
}

export function computeSubscriptionExpiry(days = DEFAULT_SUBSCRIPTION_DAYS): Date {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + days);
  return expiry;
}

export async function activateSubscriptionForUser(params: {
  user: IUser;
  expiry?: Date;
  plan?: SubscriptionPlan | null;
  razorpaySubscriptionId?: string | null;
}): Promise<IUser> {
  const { user, expiry, razorpaySubscriptionId, plan } = params;
  user.subscriptionActive = true;
  user.subscriptionExpiry = expiry ?? computeSubscriptionExpiry();
  if (plan) user.subscriptionPlan = plan;
  if (razorpaySubscriptionId) {
    user.razorpaySubscriptionId = razorpaySubscriptionId;
  }
  await user.save();
  return user;
}
