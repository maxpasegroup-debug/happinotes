import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api } from "@/services/api";
import { BookCard } from "@/components/BookCard";
import { Book, BookLanguage } from "@/types/book";

type BooksResponse = {
  success: boolean;
  books: Book[];
};

type LanguageFilter = "all" | BookLanguage;

type RecentProgress = {
  _id: string;
  bookId: Pick<Book, "_id" | "title" | "coverImageUrl" | "totalDurationSeconds">;
  chapterId: {
    _id: string;
    title: string;
    chapterNumber: number;
    durationSeconds: number;
  };
  positionSeconds: number;
};

type RecentProgressResponse = {
  success: boolean;
  progress: RecentProgress[];
};

const filters: { label: string; value: LanguageFilter }[] = [
  { label: "All", value: "all" },
  { label: "English", value: "english" },
  { label: "Malayalam", value: "malayalam" },
  { label: "Hindi", value: "hindi" },
];

export default function Home() {
  const router = useRouter();
  const [books, setBooks] = useState<Book[]>([]);
  const [featured, setFeatured] = useState<Book[]>([]);
  const [recentProgress, setRecentProgress] = useState<RecentProgress[]>([]);
  const [language, setLanguage] = useState<LanguageFilter>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadBooks = useCallback(async () => {
    setError("");
    const query = language === "all" ? "" : `?language=${language}`;
    const [booksResult, featuredResult] = await Promise.all([
      api.get<BooksResponse>(`/books${query}`),
      api.get<BooksResponse>("/books/featured"),
    ]);
    const recentResult = await api.get<RecentProgressResponse>("/progress/recent");

    if (booksResult.success && booksResult.data) {
      setBooks(booksResult.data.books);
    } else {
      setError(booksResult.error || "Could not load books.");
    }

    if (featuredResult.success && featuredResult.data) {
      setFeatured(featuredResult.data.books);
    }
    if (recentResult.success && recentResult.data) {
      setRecentProgress(recentResult.data.progress);
    }
  }, [language]);

  useEffect(() => {
    setLoading(true);
    loadBooks().finally(() => setLoading(false));
  }, [loadBooks]);

  const refresh = async () => {
    setRefreshing(true);
    await loadBooks();
    setRefreshing(false);
  };

  const heroBook = featured[0] || books.find((book) => book.isFeatured) || books[0];
  const freeBooks = useMemo(() => books.filter((book) => book.accessType === "free"), [books]);
  const premiumBooks = useMemo(
    () => books.filter((book) => book.accessType === "premium"),
    [books]
  );

  const openBook = (book: Book) => router.push(`/(app)/book/${book._id}`);

  const renderSection = (title: string, data: Book[]) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {data.length ? (
          data.map((book) => <BookCard key={book._id} book={book} onPress={() => openBook(book)} />)
        ) : (
          <View style={styles.emptyShelf}>
            <Text style={styles.emptyShelfText}>No books here yet.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );

  const renderContinueListening = () => {
    if (!recentProgress.length) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Continue Listening</Text>
        {recentProgress.map((item) => {
          const percent = item.bookId.totalDurationSeconds
            ? Math.min(100, Math.round((item.positionSeconds / item.bookId.totalDurationSeconds) * 100))
            : 0;

          return (
            <Pressable
              key={item._id}
              style={styles.continueCard}
              onPress={() =>
                router.push(`/(app)/player?bookId=${item.bookId._id}&chapterId=${item.chapterId._id}`)
              }
            >
              {item.bookId.coverImageUrl ? (
                <Image
                  source={{ uri: item.bookId.coverImageUrl }}
                  style={styles.continueCover}
                  contentFit="cover"
                />
              ) : (
                <View style={styles.continueCover} />
              )}
              <View style={styles.continueText}>
                <Text style={styles.continueTitle} numberOfLines={1}>
                  {item.bookId.title}
                </Text>
                <Text style={styles.continueMeta} numberOfLines={1}>
                  {item.chapterId.title}
                </Text>
                <View style={styles.continueProgressTrack}>
                  <View style={[styles.continueProgressFill, { width: `${percent}%` }]} />
                </View>
              </View>
              <Text style={styles.continuePercent}>{percent}%</Text>
            </Pressable>
          );
        })}
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      <Text style={styles.header}>HappiNotes</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
      >
        {filters.map((filter) => (
          <Pressable
            key={filter.value}
            style={[styles.filter, language === filter.value && styles.filterActive]}
            onPress={() => setLanguage(filter.value)}
          >
            <Text style={[styles.filterText, language === filter.value && styles.filterTextActive]}>
              {filter.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {heroBook ? (
        <Pressable style={styles.hero} onPress={() => openBook(heroBook)}>
          {heroBook.coverImageUrl ? (
            <Image source={{ uri: heroBook.coverImageUrl }} style={styles.heroImage} contentFit="cover" />
          ) : (
            <View style={styles.heroImage} />
          )}
          <View style={styles.heroShade} />
          <View style={styles.heroText}>
            <Text style={styles.heroKicker}>{heroBook.accessType.toUpperCase()}</Text>
            <Text style={styles.heroTitle} numberOfLines={2}>
              {heroBook.title}
            </Text>
            <Text style={styles.heroCta}>Start Listening</Text>
          </View>
        </Pressable>
      ) : null}

      {loading ? (
        <View style={styles.skeletonWrap}>
          {[1, 2, 3].map((item) => (
            <View key={item} style={styles.skeleton} />
          ))}
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {renderContinueListening()}
      {renderSection("New Releases", books)}
      {renderSection("Free Books", freeBooks)}
      {renderSection("Premium Books", premiumBooks)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  content: {
    padding: 20,
    paddingTop: 54,
  },
  header: {
    color: "#181818",
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 16,
  },
  filters: {
    gap: 8,
    paddingBottom: 18,
  },
  filter: {
    borderColor: "#D0D5DD",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  filterActive: {
    backgroundColor: "#FF6B4A",
    borderColor: "#FF6B4A",
  },
  filterText: {
    color: "#344054",
    fontWeight: "700",
  },
  filterTextActive: {
    color: "#FFFFFF",
  },
  hero: {
    height: 260,
    borderRadius: 8,
    marginBottom: 28,
    overflow: "hidden",
    backgroundColor: "#EFEFEF",
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#FFE8E1",
  },
  heroShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.34)",
  },
  heroText: {
    bottom: 20,
    left: 18,
    position: "absolute",
    right: 18,
  },
  heroKicker: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 8,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "900",
    marginBottom: 14,
  },
  heroCta: {
    alignSelf: "flex-start",
    backgroundColor: "#FF6B4A",
    borderRadius: 8,
    color: "#FFFFFF",
    fontWeight: "800",
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    color: "#181818",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 14,
  },
  skeletonWrap: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  skeleton: {
    width: 104,
    height: 154,
    borderRadius: 8,
    backgroundColor: "#EAECF0",
  },
  emptyShelf: {
    alignItems: "center",
    backgroundColor: "#F7F7F7",
    borderRadius: 8,
    height: 90,
    justifyContent: "center",
    paddingHorizontal: 30,
  },
  emptyShelfText: {
    color: "#667085",
  },
  error: {
    color: "#B42318",
    marginBottom: 16,
  },
  continueCard: {
    alignItems: "center",
    backgroundColor: "#F7F7F7",
    borderRadius: 8,
    flexDirection: "row",
    gap: 12,
    marginBottom: 10,
    padding: 10,
  },
  continueCover: {
    backgroundColor: "#FFE8E1",
    borderRadius: 6,
    height: 58,
    width: 44,
  },
  continueText: {
    flex: 1,
  },
  continueTitle: {
    color: "#181818",
    fontSize: 15,
    fontWeight: "800",
  },
  continueMeta: {
    color: "#667085",
    fontSize: 12,
    marginTop: 3,
  },
  continueProgressTrack: {
    backgroundColor: "#EAECF0",
    borderRadius: 5,
    height: 7,
    marginTop: 9,
    overflow: "hidden",
  },
  continueProgressFill: {
    backgroundColor: "#FF6B4A",
    height: "100%",
  },
  continuePercent: {
    color: "#344054",
    fontSize: 12,
    fontWeight: "800",
  },
});
