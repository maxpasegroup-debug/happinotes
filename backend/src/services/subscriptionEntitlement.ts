import { Types } from 'mongoose';
import { User, ISubscriptionEntitlement } from '../models';
import { isAccountWritable } from './accountDeletion';

export type IncomingSubscriptionEntitlement = Omit<ISubscriptionEntitlement, 'lastVerifiedAt'> & {
  lastVerifiedAt?: Date;
};

function timestamp(value: Date | string | undefined): number {
  if (!value) return 0;
  const result = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(result) ? 0 : result;
}

function isCurrentlyActive(value: Partial<ISubscriptionEntitlement> | undefined): boolean {
  const expiry = timestamp(value?.expiresAt);
  return value?.active === true && expiry > Date.now();
}

/**
 * Decide whether an authoritative provider state may replace the user's
 * current entitlement. A state from the same transaction may move through
 * cancellation, grace, expiry, refund, and renewal. A different transaction
 * may only replace an active one when it extends (rather than shortens) the
 * entitlement; an inactive stale event can never remove another active claim.
 */
export function shouldReplaceSubscriptionEntitlement(
  current: Partial<ISubscriptionEntitlement> | undefined,
  incoming: Partial<ISubscriptionEntitlement>,
): boolean {
  if (!current) return true;
  const currentSignedAt = timestamp(current.providerStateSignedAt);
  const incomingSignedAt = timestamp(incoming.providerStateSignedAt);
  if (currentSignedAt > 0 && incomingSignedAt > 0 && incomingSignedAt < currentSignedAt) return false;
  if (current.transactionKey && current.transactionKey === incoming.transactionKey) return true;

  const currentActive = isCurrentlyActive(current);
  const incomingActive = isCurrentlyActive(incoming);
  if (currentActive && !incomingActive) return false;
  if (currentActive && incomingActive) {
    return timestamp(incoming.expiresAt) >= timestamp(current.expiresAt);
  }
  return true;
}

/**
 * Apply an entitlement with an optimistic owner/transaction guard. If another
 * lifecycle event wins the race between the read and update, this update is
 * discarded rather than downgrading the newer state.
 */
export async function applySubscriptionEntitlement(
  userId: Types.ObjectId | string,
  incoming: IncomingSubscriptionEntitlement,
): Promise<boolean> {
  if (!(await isAccountWritable(userId))) return false;
  const user = await User.findById(userId).select('subscription');
  if (!user || !shouldReplaceSubscriptionEntitlement(user.subscription, incoming)) return false;

  const currentKey = user.subscription?.transactionKey;
  const filter: Record<string, unknown> = {
    _id: userId,
    $or: [{ deletionState: 'active' }, { deletionState: { $exists: false } }],
  };
  if (currentKey) filter['subscription.transactionKey'] = currentKey;
  else filter['subscription.transactionKey'] = { $exists: false };
  if (incoming.providerStateSignedAt) {
    filter.$and = [{ $or: [
      { 'subscription.providerStateSignedAt': { $lte: incoming.providerStateSignedAt } },
      { 'subscription.providerStateSignedAt': { $exists: false } },
    ] }];
  }

  const result = await User.updateOne(filter, { $set: { subscription: incoming } });
  const writeResult = result as unknown as { matchedCount?: number; n?: number };
  return (writeResult.matchedCount ?? writeResult.n ?? 0) > 0;
}
