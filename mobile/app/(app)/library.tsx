import React, { useMemo, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import { getBooks } from "../../services/api";
import { getToken } from "../../services/authStorage";
import type { ApiBook } from "../../services/api";

const LANGUAGES = ["English", "Hindi", "Tamil", "Malayalam"] as const;
type Language = (typeof LANGUAGES)[number];

type BookWithLanguages = ApiBook & { languages?: string[] };

function LanguageFilter({
  selected,
  onSelect,
}: {
  selected: Language;
  onSelect: (lang: Language) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.languageScrollContent}
      style={styles.languageScroll}
    >
      {LANGUAGES.map((lang) => {
        const isSelected = selected === lang;
        return (
          <TouchableOpacity
            key={lang}
            onPress={() => onSelect(lang)}
            style={[styles.pill, isSelected && styles.pillSelected]}
            activeOpacity={0.8}
          >
            <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
              {lang}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

export default function Library() {
  const [books, setBooks] = useState<ApiBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState<Language>("English");

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

  const filteredBooks = useMemo(() => {
    return books.filter((book) => {
      const langs = (book as BookWithLanguages).languages ?? ["English"];
      return langs.includes(selectedLanguage);
    });
  }, [books, selectedLanguage]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.header}>Lifebooks</Text>

        <LanguageFilter selected={selectedLanguage} onSelect={setSelectedLanguage} />

        <FlatList
          data={filteredBooks}
          keyExtractor={(item) => item._id}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.listContent}
          listEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No Lifebooks available.</Text>
              <Text style={styles.emptySub}>
                Check back later or try another language.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Image
                source={{ uri: item.coverImage }}
                style={styles.thumbnail}
                contentFit="cover"
              />
              <Text style={styles.title} numberOfLines={2}>
                {item.title}
              </Text>
            </View>
          )}
        />
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
    flex: 1,
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
  languageScroll: {
    marginBottom: 20,
  },
  languageScrollContent: {
    paddingVertical: 4,
    alignItems: "center",
    flexDirection: "row",
  },
  pill: {
    paddingHorizontal: 16,
    justifyContent: "center",
    height: 38,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginRight: 10,
    backgroundColor: "transparent",
  },
  pillSelected: {
    backgroundColor: "#1F2937",
    borderColor: "#1F2937",
  },
  pillText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#4B5563",
  },
  pillTextSelected: {
    color: "#FFFFFF",
  },
  listContent: {
    paddingBottom: 24,
    flexGrow: 1,
  },
  columnWrapper: {
    marginBottom: 16,
  },
  card: {
    flex: 1,
    marginHorizontal: 6,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#F9FAFB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  thumbnail: {
    width: "100%",
    aspectRatio: 0.7,
    backgroundColor: "#E5E7EB",
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    marginTop: 8,
    paddingHorizontal: 10,
    paddingBottom: 12,
    color: "#1F2937",
  },
  emptyWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    color: "#6B7280",
  },
});
