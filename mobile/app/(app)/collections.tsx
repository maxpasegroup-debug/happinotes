import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { BookCard } from "@/components/BookCard";
import { api } from "@/services/api";
import type { Book } from "@/types/book";

type CollectionResponse = {
  success: boolean;
  collection: Book[];
};

export default function Collections() {
  const router = useRouter();
  const [books, setBooks] = useState<Book[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadCollection = useCallback(async () => {
    const result = await api.get<CollectionResponse>("/collection");
    if (result.success && result.data) {
      setBooks(result.data.collection);
      setError("");
    } else {
      setError(result.error || "Could not load library.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCollection();
    }, [loadCollection])
  );

  async function refresh() {
    setRefreshing(true);
    await loadCollection();
    setRefreshing(false);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>My Library</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={books}
        keyExtractor={(item) => item._id}
        numColumns={2}
        columnWrapperStyle={{ gap: 14 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        renderItem={({ item }) => (
          <BookCard book={item} onPress={() => router.push(`/(app)/book/${item._id}`)} />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No books yet. Browse the library!</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF", padding: 20, paddingTop: 54 },
  header: { color: "#181818", fontSize: 26, fontWeight: "900", marginBottom: 20 },
  emptyContainer: { alignItems: "center", marginTop: 60 },
  emptyText: { color: "#667085", fontSize: 16, fontWeight: "700" },
  error: { color: "#B42318", marginBottom: 12 },
});
