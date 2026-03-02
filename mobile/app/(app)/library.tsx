import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { RADIANT_GRADIENT_DARK, RADIANT_GRADIENT_LIGHT } from "@/theme/gradients";
import { useAppTheme } from "@/theme/theme";
import { getBooks } from "../../services/api";
import { getToken } from "../../services/authStorage";
import type { ApiBook } from "../../services/api";

export default function Library() {
  const { isDark } = useAppTheme();
  const [books, setBooks] = useState<ApiBook[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const token = await getToken();
        const response = await getBooks(token ?? undefined);
        if (!cancelled) {
          setBooks(response.books);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Failed to load books";
          Alert.alert("Error", message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const heroGradientStyle = {
    padding: 28,
    borderRadius: 28,
    overflow: "hidden" as const,
    ...(isDark
      ? {}
      : {
          shadowColor: "#F59E0B",
          shadowOpacity: 0.25,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 8 },
        }),
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={books}
        keyExtractor={(item) => item._id}
        ListHeaderComponent={
          <View>
            <View style={{ marginBottom: 24 }}>
              <LinearGradient
                colors={
                  isDark ? [...RADIANT_GRADIENT_DARK] : [...RADIANT_GRADIENT_LIGHT]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={heroGradientStyle}
              >
                <Text style={styles.welcomeTitle}>Welcome back</Text>
                <Text style={styles.welcomeSubtitle}>
                  Let's continue your journey.
                </Text>
              </LinearGradient>
            </View>
            <Text style={styles.header}>Audio Library</Text>
          </View>
        }
        renderItem={({ item }) => {
          const badgeText =
            item.type === "free"
              ? "Free"
              : (item as ApiBook & { fullAudioUrl?: string }).fullAudioUrl
                ? "Premium"
                : "Subscribe to Unlock";
          return (
            <View style={styles.card}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.subtitle}>
                {item.description || "No description"}
              </Text>
              <Text style={styles.badge}>{badgeText}</Text>
            </View>
          );
        }}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    padding: 20,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  header: {
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 20,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "white",
  },
  welcomeSubtitle: {
    marginTop: 8,
    fontSize: 16,
    color: "rgba(255,255,255,0.85)",
  },
  listContent: {
    paddingBottom: 20,
  },
  card: {
    backgroundColor: "#F4F4F4",
    padding: 20,
    borderRadius: 16,
    marginBottom: 15,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
  },
  subtitle: {
    color: "#666",
    marginTop: 5,
  },
  badge: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "600",
    color: "#FF6B4A",
  },
});
