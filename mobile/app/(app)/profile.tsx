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
  logoutUser,
} from "../../store";
import { getAuth } from "@/store/authStore";
import { api } from "@/services/api";
import i18n from "@/i18n";

export default function Profile() {
  const router = useRouter();
  const [subscription, setSubscription] = useState("free");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [expiry, setExpiry] = useState<string | null>(null);
  const [language, setLanguage] = useState("all");

  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        const { user } = await getAuth();
        setSubscription(user?.subscriptionStatus || "free");
        setEmail(user?.email || "");
        setName(user?.name || "");
        setExpiry(user?.subscriptionExpiry || null);
        setLanguage(user?.languagePreference || "all");
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

  const updateLanguage = async (nextLanguage: string) => {
    setLanguage(nextLanguage);
    await api.put("/auth/me", { languagePreference: nextLanguage });
    const lng = nextLanguage === "all" ? "en" : nextLanguage === "malayalam" ? "ml" : nextLanguage === "hindi" ? "hi" : "en";
    await i18n.changeLanguage(lng);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Profile</Text>

      <View style={styles.card}>
        <Text style={styles.email}>{email}</Text>
        {name ? <Text style={styles.name}>{name}</Text> : null}
        <Text style={styles.status}>
          {subscription === "free" ? "Free Member" : `${subscription.toUpperCase()} Member`}
        </Text>
        {expiry && subscription !== "lifetime" ? (
          <Text style={styles.expiry}>Expires {new Date(expiry).toLocaleDateString()}</Text>
        ) : null}
      </View>

      {subscription === "free" ? (
        <TouchableOpacity
          style={styles.upgradeButton}
          onPress={() => router.push("/(app)/subscribe")}
        >
          <Text style={styles.upgradeText}>Upgrade to Premium</Text>
        </TouchableOpacity>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Language Preference</Text>
        <View style={styles.languageRow}>
          {["all", "english", "malayalam", "hindi"].map((item) => (
            <TouchableOpacity
              key={item}
              style={[styles.languageChip, language === item && styles.languageChipActive]}
              onPress={() => updateLanguage(item)}
            >
              <Text style={[styles.languageText, language === item && styles.languageTextActive]}>
                {item}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
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
  name: {
    color: "#667085",
    marginBottom: 8,
  },
  status: {
    fontWeight: "600",
    color: "#FF6B4A",
  },
  expiry: {
    color: "#667085",
    marginTop: 8,
  },
  upgradeButton: {
    alignItems: "center",
    backgroundColor: "#FF6B4A",
    borderRadius: 12,
    marginBottom: 15,
    padding: 16,
  },
  upgradeText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  secondaryButton: {
    backgroundColor: "#F4F4F4",
    padding: 16,
    borderRadius: 12,
    marginBottom: 15,
  },
  sectionLabel: {
    color: "#181818",
    fontWeight: "900",
    marginBottom: 12,
  },
  languageRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  languageChip: {
    borderColor: "#D0D5DD",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  languageChipActive: {
    backgroundColor: "#FF6B4A",
    borderColor: "#FF6B4A",
  },
  languageText: {
    color: "#344054",
    fontWeight: "800",
    textTransform: "capitalize",
  },
  languageTextActive: {
    color: "#FFFFFF",
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
