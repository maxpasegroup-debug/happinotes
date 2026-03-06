import type { IUser } from '../models/User';

const DEFAULT_SUBSCRIPTION_DAYS = 30;

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
  razorpaySubscriptionId?: string | null;
}): Promise<IUser> {
  const { user, expiry, razorpaySubscriptionId } = params;
  user.subscriptionActive = true;
  user.subscriptionExpiry = expiry ?? computeSubscriptionExpiry();
  if (razorpaySubscriptionId) {
    user.razorpaySubscriptionId = razorpaySubscriptionId;
  }
  await user.save();
  return user;
}
