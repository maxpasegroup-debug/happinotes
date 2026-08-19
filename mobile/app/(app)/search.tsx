import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { BookCard } from "@/components/BookCard";
import { api } from "@/services/api";
import type { Book } from "@/types/book";
import { useRealtime } from "@/contexts/RealtimeContext";
import { Ionicons } from "@expo/vector-icons";
import { UserPalette as Palette } from "@/constants/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type BooksResponse = { success: boolean; books: Book[] };

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { booksRevision } = useRealtime();
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("all");
  const [accessType, setAccessType] = useState("");
  const [books, setBooks] = useState<Book[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const search = useCallback(async (nextQuery = query, nextLanguage = language, nextAccess = accessType) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (nextQuery) params.set("query", nextQuery);
    if (nextLanguage !== "all") params.set("language", nextLanguage);
    if (nextAccess) params.set("accessType", nextAccess);
    const result = await api.get<BooksResponse>(`/books?${params.toString()}`);
    if (result.success && result.data) {
      setBooks(result.data.books);
      setError("");
    } else {
      setError(result.error || "Search failed.");
    }
    setLoading(false);
  }, [query, language, accessType]);

  useEffect(() => { void search(); }, [booksRevision, search]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <Text style={styles.header}>Search</Text>
      <View style={styles.searchSurface}><Ionicons name="search" size={21} color={Palette.muted} /><TextInput
        style={styles.input}
        placeholder="Search title or description"
        placeholderTextColor={Palette.muted}
        selectionColor="#FF6B4A"
        cursorColor={Palette.coral}
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={() => search()}
      />{query ? <Pressable accessibilityLabel="Clear search" onPress={() => { setQuery(""); void search(""); }}><Ionicons name="close-circle" size={21} color={Palette.muted} /></Pressable> : null}</View>
      <View style={styles.chips}>
        {["all", "english", "malayalam", "hindi"].map((item) => (
          <Pressable key={item} style={[styles.chip, language === item && styles.chipActive]} onPress={() => { setLanguage(item); search(query, item, accessType); }}>
            <Text style={[styles.chipText, language === item && styles.chipTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.chips}>
        {["", "free", "premium"].map((item) => (
          <Pressable key={item || "all"} style={[styles.chip, accessType === item && styles.chipActive]} onPress={() => { setAccessType(item); search(query, language, item); }}>
            <Text style={[styles.chipText, accessType === item && styles.chipTextActive]}>{item || "all"}</Text>
          </Pressable>
        ))}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={books}
        keyExtractor={(item) => item._id}
        numColumns={2}
        columnWrapperStyle={{ gap: 14 }}
        contentContainerStyle={{ paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        renderItem={({ item }) => (
          <BookCard layout="grid" book={item} onPress={() => router.push(`/(app)/book/${item._id}`)} />
        )}
        ListEmptyComponent={loading ? <View style={styles.loadingWrap}>{[1,2,3,4].map(item => <View key={item} style={styles.skeleton} />)}</View> : <View style={styles.emptyWrap}><Ionicons name="search-outline" size={30} color={Palette.muted} /><Text style={styles.emptyTitle}>{query ? `No results for "${query}"` : "Nothing matches these filters"}</Text><Text style={styles.empty}>Try another title, language, or access type.</Text><Pressable onPress={() => { setQuery(""); setLanguage("all"); setAccessType(""); void search("", "all", ""); }}><Text style={styles.reset}>Clear filters</Text></Pressable></View>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Palette.canvas, padding: 16 },
  header: { color: Palette.ink, fontSize: 26, fontWeight: "900", marginBottom: 14 },
  searchSurface: { alignItems: "center", backgroundColor: Palette.paper, borderRadius: 14, flexDirection: "row", paddingHorizontal: 14 },
  input: { color: Palette.ink, flex: 1, fontSize: 16, paddingHorizontal: 10, paddingVertical: 15 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  chip: { borderColor: Palette.line, borderRadius: 16, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  chipActive: { backgroundColor: Palette.coral, borderColor: Palette.coral },
  chipText: { color: Palette.ink, fontWeight: "800", textTransform: "capitalize" },
  chipTextActive: { color: "#FFFFFF" },
  error: { color: Palette.danger, marginTop: 12 },
  emptyWrap: { alignItems: "flex-start", marginTop: 34, paddingHorizontal: 8 },
  emptyTitle: { color: Palette.ink, fontSize: 19, fontWeight: "800", marginTop: 10 },
  empty: { color: Palette.muted, marginTop: 7 },
  reset: { color: Palette.coral, fontWeight: "800", marginTop: 14 },
  loadingWrap: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 24 },
  skeleton: { aspectRatio: 0.73, backgroundColor: Palette.paper, borderRadius: 12, width: "47%" },
});
