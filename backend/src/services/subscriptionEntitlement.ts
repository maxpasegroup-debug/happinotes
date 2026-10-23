import { StoreSubscription } from '../models';
import type { IUser } from '../models/User';

export const syncSubscriptionEntitlement = async <T extends IUser>(user: T): Promise<T> => {
  const now = new Date();
  if (user.subscriptionStatus === 'lifetime') return user;

  const storeEntitlement = await StoreSubscription.findOne({
    userId: user._id,
    state: 'active',
    expiresAt: { $gt: now },
  }).sort({ expiresAt: -1 });

  const activeAdminGrant =
    user.subscriptionSource === 'admin' &&
    user.subscriptionStatus === 'premium' &&
    (!user.subscriptionExpiry || user.subscriptionExpiry > now);
  if (activeAdminGrant) return user;

  if (storeEntitlement) {
    user.subscriptionStatus = 'premium';
    user.subscriptionExpiry = storeEntitlement.expiresAt;
    user.subscriptionSource = storeEntitlement.store;
    await user.save();
    return user;
  }

  if (user.subscriptionStatus === 'premium') {
    user.subscriptionStatus = 'free';
    user.subscriptionExpiry = null;
    user.subscriptionSource = null;
    await user.save();
  }
  return user;
};
