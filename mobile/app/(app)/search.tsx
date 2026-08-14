import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { BookCard } from "@/components/BookCard";
import { api } from "@/services/api";
import type { Book } from "@/types/book";
import { useRealtime } from "@/contexts/RealtimeContext";

type BooksResponse = { success: boolean; books: Book[] };

export default function SearchScreen() {
  const router = useRouter();
  const { booksRevision } = useRealtime();
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("all");
  const [accessType, setAccessType] = useState("");
  const [books, setBooks] = useState<Book[]>([]);
  const [error, setError] = useState("");

  const search = useCallback(async (nextQuery = query, nextLanguage = language, nextAccess = accessType) => {
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
  }, [query, language, accessType]);

  useEffect(() => { void search(); }, [booksRevision, search]);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Search</Text>
      <TextInput
        style={styles.input}
        placeholder="Search title or description"
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={() => search()}
      />
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
        renderItem={({ item }) => (
          <BookCard layout="grid" book={item} onPress={() => router.push(`/(app)/book/${item._id}`)} />
        )}
        ListEmptyComponent={<Text style={styles.empty}>Search the library.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF", padding: 20, paddingTop: 54 },
  header: { color: "#181818", fontSize: 28, fontWeight: "900", marginBottom: 16 },
  input: { backgroundColor: "#F2F4F7", borderRadius: 8, padding: 14 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  chip: { borderColor: "#D0D5DD", borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  chipActive: { backgroundColor: "#FF6B4A", borderColor: "#FF6B4A" },
  chipText: { color: "#344054", fontWeight: "800", textTransform: "capitalize" },
  chipTextActive: { color: "#FFFFFF" },
  error: { color: "#B42318", marginTop: 12 },
  empty: { color: "#667085", marginTop: 30, textAlign: "center" },
});
