import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  ErrorCode,
  getAvailablePurchases,
  restorePurchases,
  useIAP,
  type ProductSubscription,
  type Purchase,
} from "expo-iap";
import { api } from "@/services/api";
import { AuthUser, getAuth, saveAuth } from "@/store/authStore";

const PRODUCTS = {
  apple: "com.happinotes.premium.monthly",
  google: "happinotes_premium_monthly",
} as const;
const productId = Platform.OS === "ios" ? PRODUCTS.apple : PRODUCTS.google;
const googleBasePlanId = "monthly";

type StoreAccountResponse = {
  success: boolean;
  accountToken: string;
  googleObfuscatedAccountId: string;
};
type VerifyResponse = {
  success: boolean;
  active: boolean;
  user: AuthUser;
  message: string;
};
type RestoreResponse = VerifyResponse & { verifiedPurchaseCount: number };

export default function Subscribe() {
  const router = useRouter();
  const [loadingProduct, setLoadingProduct] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const finishTransactionRef = useRef<ReturnType<typeof useIAP>["finishTransaction"] | null>(null);

  const handlePurchase = useCallback(async (purchase: Purchase) => {
    if (purchase.productId !== productId) {
      setBusy(false);
      setMessage("");
      setError("The store returned an unexpected product. Premium was not enabled.");
      return;
    }
    if (purchase.purchaseState === "pending") {
      setBusy(false);
      setMessage("Your payment is pending with the store. Premium will turn on after it is approved.");
      return;
    }
    if (!purchase.purchaseToken || (purchase.store !== "apple" && purchase.store !== "google")) {
      setBusy(false);
      setMessage("");
      setError("The store did not provide verifiable purchase details. Premium was not enabled.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("Checking your purchase securely...");
    const result = await api.post<VerifyResponse>("/subscriptions/verify", {
      store: purchase.store,
      productId: purchase.productId,
      purchaseToken: purchase.purchaseToken,
    });

    if (!result.success || !result.data) {
      setBusy(false);
      setMessage("");
      setError(result.error || "The purchase could not be verified. No access was granted.");
      return;
    }

    try {
      await finishTransactionRef.current?.({ purchase, isConsumable: false });
    } catch {
      // Verification already succeeded; the store can redeliver an unfinished transaction.
    }
    const auth = await getAuth();
    if (auth.token) await saveAuth(auth.token, result.data.user);
    setBusy(false);
    setMessage("");
    if (result.data.active) {
      setMessage("Purchase verified. HappiNotes Premium is active.");
    } else {
      setError("The store verified the purchase, but it is no longer active.");
    }
  }, [finishTransactionRef]);

  const {
    connected,
    subscriptions,
    fetchProducts,
    requestPurchase,
    finishTransaction,
  } = useIAP({
    onPurchaseSuccess: (purchase) => { void handlePurchase(purchase); },
    onPurchaseError: (purchaseError) => {
      setBusy(false);
      if (purchaseError.code === ErrorCode.UserCancelled) {
        setMessage("Purchase cancelled. You have not been charged.");
        return;
      }
      if (purchaseError.code === ErrorCode.DeferredPayment) {
        setMessage("Purchase approval is pending. Premium will turn on after approval.");
        return;
      }
      setError(purchaseError.message || "The store could not complete the purchase.");
    },
    onError: (storeError) => {
      setBusy(false);
      setError(storeError.message || "The store could not be reached.");
    },
  });
  finishTransactionRef.current = finishTransaction;

  const product = useMemo(
    () => subscriptions.find((item) => item.id === productId),
    [subscriptions]
  );

  useEffect(() => {
    if (!connected) return;
    let mounted = true;
    setLoadingProduct(true);
    fetchProducts({ skus: [productId], type: "subs" })
      .catch((storeError: unknown) => {
        if (mounted) setError(storeError instanceof Error ? storeError.message : "Could not load the store product.");
      })
      .finally(() => {
        if (mounted) setLoadingProduct(false);
      });
    return () => { mounted = false; };
  }, [connected, fetchProducts]);

  const buy = async () => {
    if (!connected) return setError("The app store is not ready. Please try again shortly.");
    if (!product) return setError("The monthly membership is not available in this store yet.");

    setBusy(true);
    setError("");
    setMessage("Opening the secure store checkout...");
    const account = await api.get<StoreAccountResponse>("/subscriptions/account-token");
    if (!account.success || !account.data) {
      setBusy(false);
      setMessage("");
      return setError(account.error || "Could not prepare the secure account link.");
    }

    try {
      if (Platform.OS === "ios") {
        await requestPurchase({
          request: { apple: { sku: PRODUCTS.apple, appAccountToken: account.data.accountToken } },
          type: "subs",
        });
      } else {
        const offer = (product as ProductSubscription & { subscriptionOffers?: {
          basePlanIdAndroid?: string | null;
          offerTokenAndroid?: string | null;
        }[] }).subscriptionOffers?.find((item) => item.basePlanIdAndroid === googleBasePlanId);
        if (!offer?.offerTokenAndroid) {
          setBusy(false);
          setMessage("");
          return setError("The monthly plan is not configured in Google Play yet.");
        }
        await requestPurchase({
          request: {
            google: {
              skus: [PRODUCTS.google],
              obfuscatedAccountId: account.data.googleObfuscatedAccountId,
              subscriptionOffers: [{ sku: PRODUCTS.google, offerToken: offer.offerTokenAndroid }],
            },
          },
          type: "subs",
        });
      }
      // Store results arrive through onPurchaseSuccess/onPurchaseError listeners.
    } catch (purchaseError) {
      setBusy(false);
      setMessage("");
      setError(purchaseError instanceof Error ? purchaseError.message : "The store could not start checkout.");
    }
  };

  const restore = async () => {
    if (!connected) return setError("The app store is not ready. Please try again shortly.");
    setBusy(true);
    setError("");
    setMessage("Checking purchases with the app store and HappiNotes...");
    try {
      await restorePurchases();
      const purchases = await getAvailablePurchases({ onlyIncludeActiveItemsIOS: true });
      const evidence = purchases
        .filter((purchase) => purchase.productId === productId && purchase.purchaseState === "purchased")
        .filter((purchase) => purchase.purchaseToken && (purchase.store === "apple" || purchase.store === "google"))
        .map((purchase) => ({
          store: purchase.store as "apple" | "google",
          productId: purchase.productId,
          purchaseToken: purchase.purchaseToken as string,
        }));
      const result = await api.post<RestoreResponse>("/subscriptions/restore", { purchases: evidence });
      if (!result.success || !result.data) {
        setError(result.error || "Could not verify purchases.");
        return;
      }
      const auth = await getAuth();
      if (auth.token) await saveAuth(auth.token, result.data.user);
      for (const purchase of purchases) {
        if (purchase.productId === productId && purchase.purchaseState === "purchased") {
          try {
            await finishTransaction({ purchase, isConsumable: false });
          } catch {
            // A still-unfinished verified purchase will be returned again for retry.
          }
        }
      }
      setMessage(result.data.active ? "Your verified Premium access is restored." : "No active HappiNotes Premium purchase was found.");
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : "Could not restore purchases.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Ionicons name="headset-outline" size={46} color="#FF6B4A" />
      <Text style={styles.header}>HappiNotes Premium</Text>
      <Text style={styles.subheader}>Unlock every Premium audiobook and full chapter in the listening library.</Text>
      <View style={styles.productCard}>
        <Text style={styles.productTitle}>{product?.title || "Monthly membership"}</Text>
        <Text style={styles.price}>{product?.displayPrice || (loadingProduct ? "Loading store price…" : "Not available yet")}</Text>
        <Text style={styles.period}>Billed monthly through {Platform.OS === "ios" ? "Apple" : "Google Play"}. Renews until cancelled.</Text>
        <Text style={styles.terms}>No free trial. Manage or cancel anytime in your app store account settings. Access continues through the paid period after cancellation.</Text>
      </View>

      {!connected || loadingProduct ? <ActivityIndicator color="#FF6B4A" style={styles.spinner} /> : null}
      {message ? <Text accessibilityRole="text" style={styles.message}>{message}</Text> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

      <Pressable style={[styles.button, (busy || !product) && styles.disabled]} onPress={buy} disabled={busy || !product}>
        <Text style={styles.buttonText}>{busy ? "Waiting for the store…" : `Subscribe for ${product?.displayPrice || "monthly"}`}</Text>
      </Pressable>
      <Pressable style={styles.restoreButton} onPress={restore} disabled={busy}>
        <Text style={styles.restoreText}>{busy ? "Please wait…" : "Restore Purchases"}</Text>
      </Pressable>
      <Pressable onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>Back</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  content: { flexGrow: 1, justifyContent: "center", padding: 24, paddingBottom: 48, paddingTop: 54 },
  header: { color: "#181818", fontSize: 29, fontWeight: "900", marginTop: 18 },
  subheader: { color: "#667085", fontSize: 15, lineHeight: 22, marginBottom: 22, marginTop: 8 },
  productCard: { backgroundColor: "#FFF8F4", borderColor: "#F8D8CD", borderRadius: 16, borderWidth: 1, padding: 18 },
  productTitle: { color: "#181818", fontSize: 18, fontWeight: "800" },
  price: { color: "#181818", fontSize: 28, fontWeight: "900", marginTop: 12 },
  period: { color: "#475467", fontSize: 14, marginTop: 3 },
  terms: { color: "#667085", fontSize: 12, lineHeight: 18, marginTop: 14 },
  spinner: { marginTop: 18 },
  message: { color: "#067647", fontSize: 14, lineHeight: 20, marginTop: 16, textAlign: "center" },
  error: { color: "#B42318", fontSize: 14, lineHeight: 20, marginTop: 16, textAlign: "center" },
  button: { alignItems: "center", backgroundColor: "#FF6B4A", borderRadius: 12, marginTop: 22, padding: 17 },
  disabled: { opacity: 0.55 },
  buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "900" },
  restoreButton: { alignItems: "center", marginTop: 18, padding: 12 },
  restoreText: { color: "#475467", fontSize: 15, fontWeight: "700" },
  back: { alignItems: "center", marginTop: 4, padding: 10 },
  backText: { color: "#667085", fontWeight: "700" },
});
