import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  getCurrentUser,
  getSubscription,
  logoutUser,
} from "../../store";

export default function Profile() {
  const router = useRouter();
  const [subscription, setSubscription] =
    useState<"free" | "premium">("free");
  const [email, setEmail] = useState("");

  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        const sub = await getSubscription();
        const user = await getCurrentUser();

        setSubscription(sub);
        setEmail(user?.email || "");
      };

      loadData();
    }, [])
  );

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await logoutUser();
          router.replace("/");
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Profile</Text>

      <View style={styles.card}>
        <Text style={styles.email}>{email}</Text>
        <Text style={styles.status}>
          {subscription === "premium"
            ? "Premium Member"
            : "Free Member"}
        </Text>
      </View>

      {/* Legal Button */}
      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => router.push("/legal")}
      >
        <Text style={styles.secondaryText}>Legal</Text>
      </TouchableOpacity>

      {/* History Button */}
      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => router.push("/history")}
      >
        <Text style={styles.secondaryText}>Subscription History</Text>
      </TouchableOpacity>

      {/* Logout Button */}
      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleLogout}
      >
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
  header: {
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 20,
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
