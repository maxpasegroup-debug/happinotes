import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { getCollection } from "../../services/api";
import type { ApiBook } from "../../services/api";
import { getToken } from "../../services/authStorage";

export default function Collections() {
  const [books, setBooks] = useState<ApiBook[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCollection = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) {
        setBooks([]);
        return;
      }
      const response = await getCollection(token);
      setBooks(response.collection);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load collection";
      Alert.alert("Error", message);
      setBooks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadCollection();
    }, [loadCollection])
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.container, styles.centered]}>
          <ActivityIndicator size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.header}>My Collection</Text>

        {books.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              No books in your collection yet.
            </Text>
            <Text style={styles.emptySub}>
              Add books from Lifebooks.
            </Text>
          </View>
        ) : (
          <FlatList
            data={books}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardBadge}>
                  {item.type === "premium" ? "Premium" : "Free"}
                </Text>
              </View>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginTop: 8,
    marginBottom: 16,
    color: "#1F2937",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    color: "#666",
  },
  card: {
    backgroundColor: "#F5F5F5",
    padding: 20,
    borderRadius: 16,
    marginBottom: 15,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  cardBadge: {
    marginTop: 6,
    color: "#FF6B4A",
    fontSize: 12,
    fontWeight: "600",
  },
});
