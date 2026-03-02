/**
 * Mock billing for Expo Go — react-native-iap does not work in Expo Go.
 * Replace with real implementation when building a dev client or production.
 */

import type { ApiUser } from "./api";

export const PREMIUM_PRODUCT_ID = "premium_subscription";

export async function initBilling(): Promise<void> {
  console.log("Billing disabled in Expo Go");
}

export async function purchasePremium(): Promise<{ success: boolean }> {
  console.log("Mock purchase success");
  return { success: true };
}

// Stubs for profile.tsx — same API, no-op in Expo Go
export async function initConnection(): Promise<boolean> {
  await initBilling();
  return true;
}

export function addPurchaseUpdatedListener(_onVerified: (user: ApiUser) => void): () => void {
  return () => {};
}

export async function requestSubscription(_productId: string): Promise<void> {
  await purchasePremium();
}

export async function restorePurchases(): Promise<ApiUser> {
  throw new Error("No purchases to restore");
}
