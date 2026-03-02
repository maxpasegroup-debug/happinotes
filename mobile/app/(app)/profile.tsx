import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { getMe } from "../../services/api";
import type { ApiUser } from "../../services/api";
import { getToken } from "../../services/authStorage";
import { deleteToken } from "../../services/authStorage";
import {
  initConnection,
  addPurchaseUpdatedListener,
  requestSubscription,
  restorePurchases,
  PREMIUM_PRODUCT_ID,
} from "../../services/billing";

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
      await requestSubscription(PREMIUM_PRODUCT_ID);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("already") || message.includes("owned") || message.includes("E_ALREADY")) {
        Alert.alert("Already purchased", "You already have an active subscription.");
      } else if (message.includes("cancel") || message.includes("E_USER_CANCELLED") || message.includes("User cancelled")) {
        Alert.alert("Cancelled", "Purchase was cancelled.");
      } else if (message.includes("network") || message.includes("E_NETWORK") || message.includes("Connection")) {
        Alert.alert("Network error", "Please check your connection and try again.");
      } else {
        Alert.alert("Error", message || "Purchase failed. Please try again.");
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
        Alert.alert("No purchases found", "There are no previous purchases to restore.");
      } else if (message.includes("expired") || message.includes("Could not restore")) {
        Alert.alert("Restore failed", message);
      } else {
        Alert.alert("Error", message || "Could not restore purchases. Please try again.");
      }
    } finally {
      setRestoring(false);
    }
  };

  const handleLogout = async () => {
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

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.header}>Profile</Text>
        <Text style={styles.subtitle}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Profile</Text>

      <View style={styles.card}>
        <Text style={styles.email}>{user?.email ?? ""}</Text>
        <Text style={styles.status}>
          {user?.subscriptionActive ? "Premium Member" : "Free Member"}
        </Text>
      </View>

      {user && !user.subscriptionActive && (
        <>
          <TouchableOpacity
            style={[styles.subscribeButton, subscribing && styles.buttonDisabled]}
            onPress={handleSubscribe}
            disabled={subscribing}
          >
            <Text style={styles.subscribeButtonText}>
              {subscribing ? "Please wait..." : "Subscribe ₹499 / month"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.restoreButton, restoring && styles.buttonDisabled]}
            onPress={handleRestorePurchases}
            disabled={restoring}
          >
            <Text style={styles.restoreButtonText}>
              {restoring ? "Restoring…" : "Restore Purchases"}
            </Text>
          </TouchableOpacity>
        </>
      )}

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => router.push("/legal")}
      >
        <Text style={styles.secondaryText}>Legal</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => router.push("/history")}
      >
        <Text style={styles.secondaryText}>Subscription History</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    padding: 20,
  },
  centered: {
    justifyContent: "center",
  },
  header: {
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
  },
  card: {
    backgroundColor: "#F4F4F4",
    padding: 20,
    borderRadius: 16,
    marginBottom: 30,
  },
  email: {
    fontSize: 16,
    marginBottom: 8,
  },
  status: {
    fontWeight: "600",
    color: "#FF6B4A",
  },
  subscribeButton: {
    backgroundColor: "#FF6B4A",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 20,
  },
  subscribeButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
  restoreButton: {
    backgroundColor: "transparent",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 2,
    borderColor: "#FF6B4A",
  },
  restoreButtonText: {
    color: "#FF6B4A",
    fontWeight: "600",
    fontSize: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  secondaryButton: {
    backgroundColor: "#F4F4F4",
    padding: 16,
    borderRadius: 12,
    marginBottom: 15,
  },
  secondaryText: {
    fontWeight: "600",
  },
  logoutButton: {
    backgroundColor: "#FF3B30",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 20,
  },
  logoutText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
});
