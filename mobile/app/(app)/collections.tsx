import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { BookCard } from "@/components/BookCard";
import { api } from "@/services/api";
import type { Book } from "@/types/book";
import { Ionicons } from "@expo/vector-icons";
import { UserPalette as Palette } from "@/constants/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type CollectionResponse = {
  success: boolean;
  collection: Book[];
};
type RecentResponse = { success: boolean; progress: { bookId: { _id: string } | string }[] };

export default function Collections() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [books, setBooks] = useState<Book[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [segment, setSegment] = useState<"saved" | "progress">("saved");
  const [progressIds, setProgressIds] = useState<Set<string>>(new Set());

  const loadCollection = useCallback(async () => {
    const [result, recentResult] = await Promise.all([
      api.get<CollectionResponse>("/collection"),
      api.get<RecentResponse>("/progress/recent"),
    ]);
    if (result.success && result.data) {
      setBooks(result.data.collection);
      setError("");
    } else {
      setError(result.error || "Could not load library.");
    }
    if (recentResult.success && recentResult.data) {
      setProgressIds(new Set(recentResult.data.progress.map((item) => typeof item.bookId === "string" ? item.bookId : item.bookId._id)));
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
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <Text style={styles.header}>My Library</Text>
      <View style={styles.segments}><Pressable style={[styles.segment, segment === "saved" && styles.segmentActive]} onPress={() => setSegment("saved")}><Text style={segment === "saved" ? styles.segmentActiveText : styles.segmentText}>Saved</Text></Pressable><Pressable style={[styles.segment, segment === "progress" && styles.segmentActive]} onPress={() => setSegment("progress")}><Text style={segment === "progress" ? styles.segmentActiveText : styles.segmentText}>In progress</Text></Pressable></View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={segment === "saved" ? books : books.filter((book) => progressIds.has(book._id))}
        keyExtractor={(item) => item._id}
        numColumns={2}
        columnWrapperStyle={{ gap: 14 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        renderItem={({ item }) => (
          <BookCard layout="grid" book={item} onPress={() => router.push(`/(app)/book/${item._id}`)} />
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name={segment === "saved" ? "bookmark-outline" : "headset-outline"} size={32} color={Palette.muted} /><Text style={styles.emptyTitle}>{segment === "saved" ? "Your saved books appear here" : "No listening in progress"}</Text><Text style={styles.emptyText}>{segment === "saved" ? "Keep stories close for your next listening session." : "Start a saved book and your progress will appear here."}</Text><Pressable style={styles.browseButton} onPress={() => router.push("/(app)/home")}><Text style={styles.browseText}>Browse books</Text><Ionicons name="arrow-forward" size={18} color="#fff" /></Pressable>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Palette.canvas, padding: 16 },
  header: { color: Palette.ink, fontSize: 26, fontWeight: "900", marginBottom: 18 },
  segments: { backgroundColor: Palette.paper, borderRadius: 12, flexDirection: "row", marginBottom: 18, padding: 4 },
  segment: { alignItems: "center", flex: 1, paddingVertical: 9 },
  segmentActive: { backgroundColor: Palette.coral, borderRadius: 9 },
  segmentText: { color: Palette.muted, fontWeight: "700" },
  segmentActiveText: { color: "#fff", fontWeight: "800" },
  emptyContainer: { alignItems: "flex-start", marginTop: 40, paddingHorizontal: 8 },
  emptyTitle: { color: Palette.ink, fontSize: 20, fontWeight: "800", marginTop: 12 },
  emptyText: { color: Palette.muted, fontSize: 14, marginTop: 7 },
  browseButton: { alignItems: "center", backgroundColor: Palette.coral, borderRadius: 12, flexDirection: "row", gap: 8, marginTop: 18, paddingHorizontal: 16, paddingVertical: 12 },
  browseText: { color: "#fff", fontWeight: "800" },
  error: { color: Palette.danger, marginBottom: 12 },
  list: { paddingBottom: 120 },
});
