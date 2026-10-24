import { SubscriptionPlanKey, SubscriptionStore } from '../models/User';

export type SubscriptionProductPlan = {
  key: SubscriptionPlanKey;
  productId: string;
  active?: boolean;
  storeProductIds?: { android?: string; ios?: string };
};

export type LegacySubscriptionClaim = {
  store: SubscriptionStore;
  productId: string;
  planKey: SubscriptionPlanKey;
};

function nonEmpty(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function appleEnvironmentKey(planKey: SubscriptionPlanKey): string {
  return `APPLE_IAP_SUBSCRIPTION_${planKey.toUpperCase()}_PRODUCT_ID`;
}

/** Resolve the configured product ID for exactly one store. */
export function subscriptionProductIdForStore(
  plan: SubscriptionProductPlan,
  store: SubscriptionStore,
): string | undefined {
  const stored = nonEmpty(plan.storeProductIds?.[store]);
  if (stored) return stored;

  if (store === 'android') return nonEmpty(plan.productId);
  return undefined;
}

/** Return a client-facing plan with explicit store keys; never alias Apple to Google. */
export function exposeSubscriptionStoreProductIds<T extends SubscriptionProductPlan>(plan: T): T & {
  storeProductIds: { android?: string; ios?: string };
} {
  return {
    ...plan,
    storeProductIds: {
      android: subscriptionProductIdForStore(plan, 'android'),
      ios: subscriptionProductIdForStore(plan, 'ios') ??
        nonEmpty(process.env[appleEnvironmentKey(plan.key)]),
    },
  };
}

/**
 * Resolve a new/current purchase only from the requested store's active mapping.
 * A legacy identifier is accepted only when the route supplies an existing
 * same-user ledger claim, which is used for restore compatibility.
 */
export function resolveSubscriptionPlanForStoreProduct<T extends SubscriptionProductPlan>(
  plans: T[],
  store: SubscriptionStore,
  productId: string,
  legacyClaim?: LegacySubscriptionClaim | null,
): T | undefined {
  const matches = plans.filter((plan) => plan.active === true &&
    subscriptionProductIdForStore(plan, store) === productId);
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) return undefined;

  if (!legacyClaim || legacyClaim.store !== store || legacyClaim.productId !== productId) {
    return undefined;
  }
  return plans.find((plan) => plan.key === legacyClaim.planKey);
}
