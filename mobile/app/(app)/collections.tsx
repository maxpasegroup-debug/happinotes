import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Book, getCollection } from "../../store";

export default function Collections() {
  const [books, setBooks] = useState<Book[]>([]);

  const loadCollection = async () => {
    const data = await getCollection();
    setBooks(data);
  };

  useFocusEffect(
    useCallback(() => {
      loadCollection();
    }, [])
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>My Collection</Text>

      {books.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            No books in your collection yet.
          </Text>
          <Text style={styles.emptySub}>
            Add books from Library.
          </Text>
        </View>
      ) : (
        <FlatList
          data={books}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {item.title}
              </Text>
              <Text style={styles.cardBadge}>
                {item.access === "premium"
                  ? "Premium"
                  : "Free"}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    padding: 20,
    paddingTop: 50,
  },
  header: {
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 20,
  },
  emptyContainer: {
    marginTop: 60,
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
