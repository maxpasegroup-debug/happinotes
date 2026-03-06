import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  AppState,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getMe } from "../../services/api";
import type { ApiUser } from "../../services/api";
import { deleteToken, getToken } from "../../services/authStorage";
import {
  addPurchaseUpdatedListener,
  initConnection,
  restorePurchases,
  PREMIUM_PRODUCT_ID,
  WEB_SUBSCRIBE_URL,
} from "../../services/billing";

function formatExpiry(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function Profile() {
  const router = useRouter();
  const [user, setUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const loadUser = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const res = await getMe(token);
      setUser(res.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        loadUser();
      }
    });
    return () => sub.remove();
  }, [loadUser]);

  useEffect(() => {
    initConnection();
    const remove = addPurchaseUpdatedListener((verifiedUser) => {
      setUser(verifiedUser);
      loadUser();
    });
    return remove;
  }, [loadUser]);

  const handleSubscribe = async () => {
    if (subscribing || !user) return;
    setSubscribing(true);
    try {
      if (Platform.OS === "android") {
        await Linking.openURL(WEB_SUBSCRIBE_URL);
      } else if (Platform.OS === "ios") {
        Alert.alert(
          "Coming soon",
          "Apple In-App Purchase will be enabled soon. Please use web subscribe for now."
        );
      } else {
        await Linking.openURL(WEB_SUBSCRIBE_URL);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (
        message.includes("already") ||
        message.includes("owned") ||
        message.includes("E_ALREADY")
      ) {
        Alert.alert(
          "Already purchased",
          "You already have an active subscription."
        );
      } else if (
        message.includes("cancel") ||
        message.includes("E_USER_CANCELLED") ||
        message.includes("User cancelled")
      ) {
        Alert.alert("Cancelled", "Purchase was cancelled.");
      } else if (
        message.includes("network") ||
        message.includes("E_NETWORK") ||
        message.includes("Connection")
      ) {
        Alert.alert(
          "Network error",
          "Please check your connection and try again."
        );
      } else {
        Alert.alert(
          "Error",
          message || "Purchase failed. Please try again."
        );
      }
    } finally {
      setSubscribing(false);
    }
  };

  const handleRestorePurchases = async () => {
    if (restoring || !user) return;
    setRestoring(true);
    try {
      const updatedUser = await restorePurchases();
      setUser(updatedUser);
      loadUser();
      Alert.alert("Success", "Subscription restored.");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("No purchases to restore")) {
        Alert.alert(
          "No purchases found",
          "There are no previous purchases to restore."
        );
      } else if (
        message.includes("expired") ||
        message.includes("Could not restore")
      ) {
        Alert.alert("Restore failed", message);
      } else {
        Alert.alert(
          "Error",
          message || "Could not restore purchases. Please try again."
        );
      }
    } finally {
      setRestoring(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await deleteToken();
          router.replace("/");
        },
      },
    ]);
  };

  const openSupport = () => {
    Linking.openURL("mailto:hello@happinotes.in");
  };

  if (loading) {
    return (
      <View style={[styles.safeArea, styles.centered]}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const email = user?.email ?? "";
  const initial = email ? email[0].toUpperCase() : "?";
  const isPremium = user?.isPremium ?? user?.subscriptionActive ?? false;

  return (
    <View style={styles.safeArea}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top section */}
        <View style={styles.topSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <Text style={styles.email}>{email || "No email"}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {isPremium ? "Premium" : "Free"}
            </Text>
          </View>
        </View>

        {/* Favourites card */}
        <Pressable
          style={styles.card}
          onPress={() => router.push("/favourites")}
          android_ripple={{ color: "rgba(0,0,0,0.05)" }}
        >
          <View style={styles.cardRow}>
            <Ionicons name="heart-outline" size={22} color="#374151" />
            <Text style={styles.cardTitle}>Favourites</Text>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </View>
          <Text style={styles.cardSubtext}>View your saved content</Text>
        </Pressable>

        {/* Subscription & Billing card */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Ionicons name="card-outline" size={22} color="#374151" />
            <Text style={styles.cardTitle}>Subscription & Billing</Text>
          </View>
          <Text style={styles.cardSubtext}>
            {isPremium ? "Active" : "Not active"}
          </Text>
          {isPremium ? (
            <Text style={styles.expiry}>
              Expires {formatExpiry(user?.subscriptionExpiry ?? null)}
            </Text>
          ) : (
            <View style={styles.subCardActions}>
              <Pressable
                style={[styles.primaryButton, subscribing && styles.buttonDisabled]}
                onPress={handleSubscribe}
                disabled={subscribing}
              >
                <Text style={styles.primaryButtonText}>
                  {subscribing ? "Please wait…" : Platform.OS === "android" ? "Subscribe on Web ₹499 / month" : "Subscribe ₹499 / month"}
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.secondaryButton,
                  restoring && styles.buttonDisabled,
                ]}
                onPress={handleRestorePurchases}
                disabled={restoring}
              >
                <Text style={styles.secondaryButtonText}>
                  {restoring ? "Restoring…" : "Restore Purchases"}
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Support card */}
        <Pressable
          style={styles.card}
          onPress={openSupport}
          android_ripple={{ color: "rgba(0,0,0,0.05)" }}
        >
          <View style={styles.cardRow}>
            <Ionicons name="mail-outline" size={22} color="#374151" />
            <Text style={styles.cardTitle}>Support</Text>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </View>
          <Text style={styles.cardSubtext}>Contact Support</Text>
        </Pressable>

        {/* Legal card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Legal</Text>
          <Pressable
            style={styles.legalRow}
            onPress={() => router.push("/legal")}
            android_ripple={{ color: "rgba(0,0,0,0.05)" }}
          >
            <Text style={styles.legalLabel}>Privacy Policy</Text>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </Pressable>
          <Pressable
            style={styles.legalRow}
            onPress={() => router.push("/legal")}
            android_ripple={{ color: "rgba(0,0,0,0.05)" }}
          >
            <Text style={styles.legalLabel}>Terms & Conditions</Text>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </Pressable>
        </View>

        {/* Logout */}
        <Pressable
          style={styles.logoutButton}
          onPress={handleLogout}
          android_ripple={{ color: "rgba(0,0,0,0.05)" }}
        >
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    color: "#6B7280",
  },
  topSection: {
    alignItems: "center",
    marginBottom: 28,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#FF6B4A",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  email: {
    fontSize: 16,
    color: "#374151",
    marginBottom: 8,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#E5E7EB",
  },
  badgeText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cardTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "600",
    color: "#1F2937",
  },
  cardSubtext: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 6,
    marginLeft: 34,
  },
  expiry: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 8,
  },
  subCardActions: {
    marginTop: 14,
    gap: 10,
  },
  primaryButton: {
    backgroundColor: "#FF6B4A",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  secondaryButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#FF6B4A",
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FF6B4A",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  legalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    marginTop: 4,
  },
  legalLabel: {
    fontSize: 15,
    color: "#374151",
  },
  logoutButton: {
    marginTop: 24,
    paddingVertical: 16,
    alignItems: "center",
  },
  logoutText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#DC2626",
  },
  bottomSpacer: {
    height: 24,
  },
});
