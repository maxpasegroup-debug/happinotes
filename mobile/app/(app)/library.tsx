import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { getBooks } from "../../services/api";
import { getToken } from "../../services/authStorage";
import type { ApiBook } from "../../services/api";

export default function Library() {
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

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Audio Library</Text>
      <FlatList
        data={books}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtitle}>
              {item.description || "No description"}
            </Text>
            <Text style={styles.badge}>
              {item.audioUrl ? "Premium Available" : "Subscribe to Unlock"}
            </Text>
          </View>
        )}
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
