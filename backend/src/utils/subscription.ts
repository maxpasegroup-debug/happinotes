import type { IUser } from '../models/User';

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
