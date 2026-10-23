import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { getAuth } from "@/store/authStore";

type Membership = {
  status: "free" | "premium" | "lifetime";
  source: "admin" | "apple" | "google" | null;
  expiry: string | null;
};

export default function History() {
  const router = useRouter();
  const [membership, setMembership] = useState<Membership>({ status: "free", source: null, expiry: null });

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      void getAuth().then(({ user }) => {
        if (!mounted) return;
        setMembership({
          status: user?.subscriptionStatus || "free",
          source: user?.subscriptionSource || null,
          expiry: user?.subscriptionExpiry || null,
        });
      });
      return () => { mounted = false; };
    }, [])
  );

  const manage = () => {
    const url = Platform.OS === "ios"
      ? "https://apps.apple.com/account/subscriptions"
      : "https://play.google.com/store/account/subscriptions?sku=happinotes_premium_monthly&package=com.happinotes.app";
    void Linking.openURL(url);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Your Membership</Text>
      <View style={styles.card}>
        <Text style={styles.title}>{membership.status === "free" ? "Free membership" : `HappiNotes ${membership.status}`}</Text>
        <Text style={styles.body}>
          {membership.status === "free"
            ? "Subscribe to unlock all Premium audiobooks and full chapters."
            : membership.status === "lifetime"
              ? "You have lifetime Premium access."
              : `Your verified membership is managed by ${membership.source === "apple" ? "Apple" : membership.source === "google" ? "Google Play" : "HappiNotes"}.`}
        </Text>
        {membership.expiry && membership.status !== "lifetime" ? (
          <Text style={styles.date}>Access through {new Date(membership.expiry).toLocaleDateString()}</Text>
        ) : null}
      </View>
      {membership.status === "free" ? (
        <Pressable style={styles.button} onPress={() => router.push("/(app)/subscribe")}>
          <Text style={styles.buttonText}>View monthly membership</Text>
        </Pressable>
      ) : membership.source === "apple" || membership.source === "google" ? (
        <Pressable style={styles.secondaryButton} onPress={manage}>
          <Text style={styles.secondaryText}>Manage membership in {membership.source === "apple" ? "Apple" : "Google Play"}</Text>
        </Pressable>
      ) : null}
      <Text style={styles.note}>To restore a purchase on this device, open the membership page and choose Restore Purchases.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  content: { padding: 20, paddingTop: 54 },
  header: { color: "#181818", fontSize: 26, fontWeight: "900", marginBottom: 20 },
  card: { backgroundColor: "#F7F7F7", borderRadius: 14, padding: 18 },
  title: { color: "#181818", fontSize: 18, fontWeight: "900" },
  body: { color: "#667085", lineHeight: 21, marginTop: 8 },
  date: { color: "#475467", fontSize: 13, marginTop: 12 },
  button: { alignItems: "center", backgroundColor: "#FF6B4A", borderRadius: 12, marginTop: 20, padding: 16 },
  buttonText: { color: "#FFFFFF", fontWeight: "900" },
  secondaryButton: { alignItems: "center", borderColor: "#D0D5DD", borderRadius: 12, borderWidth: 1, marginTop: 20, padding: 16 },
  secondaryText: { color: "#344054", fontWeight: "800" },
  note: { color: "#667085", fontSize: 13, lineHeight: 19, marginTop: 22, textAlign: "center" },
});
