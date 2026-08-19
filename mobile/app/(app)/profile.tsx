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
import { Ionicons } from "@expo/vector-icons";
import { UserPalette as Palette } from "@/constants/theme";
import { SafeAreaView } from "react-native-safe-area-context";

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
    <SafeAreaView style={styles.safe} edges={["top"]}><ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Profile</Text>

      <View style={styles.card}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{(name || email || "H").slice(0,1).toUpperCase()}</Text></View>
        {name ? <Text style={styles.name}>{name}</Text> : null}<Text style={styles.email}>{email}</Text>
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
        <Ionicons name="document-text-outline" size={21} color={Palette.coral} /><Text style={styles.secondaryText}>Legal</Text><Ionicons name="chevron-forward" size={19} color={Palette.muted} />
      </TouchableOpacity>

      {/* History Button */}
      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => router.push("/history")}
      >
        <Ionicons name="receipt-outline" size={21} color={Palette.coral} /><Text style={styles.secondaryText}>Subscription History</Text><Ionicons name="chevron-forward" size={19} color={Palette.muted} />
      </TouchableOpacity>

      {/* Logout Button */}
      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleLogout}
      >
        <Ionicons name="log-out-outline" size={20} color={Palette.danger} /><Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView></SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.canvas },
  container: { flex: 1 }, content: { padding: 20, paddingBottom: 120 },
  header: {
    color: Palette.ink, fontSize: 26, fontWeight: "900",
    marginBottom: 20,
  },
  card: {
    alignItems: "center", backgroundColor: Palette.paper,
    padding: 20,
    borderRadius: 16,
    marginBottom: 30,
  },
  avatar: { alignItems: "center", backgroundColor: Palette.peach, borderRadius: 32, height: 64, justifyContent: "center", marginBottom: 12, width: 64 },
  avatarText: { color: Palette.coralDark, fontSize: 27, fontWeight: "900" },
  email: {
    fontSize: 16,
    color: Palette.muted, marginTop: 4,
  },
  name: {
    color: Palette.ink, fontSize: 20, fontWeight: "800",
  },
  status: {
    fontWeight: "600",
    color: Palette.coralDark, marginTop: 10,
  },
  expiry: {
    color: Palette.muted,
    marginTop: 8,
  },
  upgradeButton: {
    alignItems: "center",
    backgroundColor: Palette.coral,
    borderRadius: 12,
    marginBottom: 15,
    padding: 16,
  },
  upgradeText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  secondaryButton: {
    alignItems: "center", backgroundColor: Palette.paper, flexDirection: "row", gap: 12,
    padding: 16,
    borderRadius: 12,
    marginBottom: 15,
  },
  sectionLabel: {
    color: Palette.ink,
    fontWeight: "900",
    marginBottom: 12,
  },
  languageRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  languageChip: {
    borderColor: Palette.line,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  languageChipActive: {
    backgroundColor: Palette.coral, borderColor: Palette.coral,
  },
  languageText: {
    color: Palette.ink,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  languageTextActive: {
    color: "#FFFFFF",
  },
  secondaryText: {
    color: Palette.ink, flex: 1, fontWeight: "700",
  },
  logoutButton: {
    backgroundColor: Palette.paper, borderColor: Palette.line, borderWidth: 1, flexDirection: "row", gap: 8, justifyContent: "center",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 20,
  },
  logoutText: {
    color: Palette.danger,
    fontWeight: "700",
    fontSize: 16,
  },
});
