import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
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
import { useRealtime } from "@/contexts/RealtimeContext";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { UserPalette as Palette, Shadows } from "@/constants/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  const { booksRevision } = useRealtime();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [books, setBooks] = useState<Book[]>([]);
  const [featured, setFeatured] = useState<Book[]>([]);
  const [upcoming, setUpcoming] = useState<Book[]>([]);
  const [recentProgress, setRecentProgress] = useState<RecentProgress[]>([]);
  const [language, setLanguage] = useState<LanguageFilter>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadBooks = useCallback(async () => {
    setError("");
    const query = language === "all" ? "" : `?language=${language}`;
    const [booksResult, featuredResult, upcomingResult] = await Promise.all([
      api.get<BooksResponse>(`/books${query}`),
      api.get<BooksResponse>("/books/featured"),
      api.get<BooksResponse>(`/books/upcoming${query}`),
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
    if (upcomingResult.success && upcomingResult.data) {
      setUpcoming(upcomingResult.data.books);
    }
    if (recentResult.success && recentResult.data) {
      setRecentProgress(recentResult.data.progress);
    }
  }, [language]);

  useEffect(() => {
    setLoading(true);
    loadBooks().finally(() => setLoading(false));
  }, [loadBooks, booksRevision]);

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

  const renderSection = (title: string, data: Book[], comingSoon = false) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {data.length ? (
          data.map((book) => (
            <BookCard
              key={book._id}
              book={book}
              onPress={() =>
                comingSoon
                  ? Alert.alert("Coming Soon", `${book.title} is not available to listen to yet.`)
                  : openBook(book)
              }
            />
          ))
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
              <View style={styles.continuePlay}><Ionicons name="play" size={16} color="#fff" /></View>
            </Pressable>
          );
        })}
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      <View style={styles.topBar}><View><Text style={styles.greeting}>Good to see you</Text><Text style={styles.header}>HappiNotes</Text></View><Pressable style={styles.avatar} onPress={() => router.push("/(app)/profile")}><Ionicons name="person" size={19} color={Palette.ink} /></Pressable></View>
      <Pressable style={styles.searchShortcut} onPress={() => router.push("/(app)/search")}>
        <Ionicons name="search" size={20} color={Palette.muted} />
        <Text style={styles.searchShortcutText}>Search books and audio</Text><Ionicons name="mic-outline" size={20} color={Palette.coral} />
      </Pressable>

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
          <LinearGradient colors={["transparent", "rgba(42,29,24,.86)"]} style={styles.heroShade} />
          <View style={styles.heroText}>
            <Text style={styles.heroKicker}>{heroBook.accessType.toUpperCase()}</Text>
            <Text style={styles.heroTitle} numberOfLines={2}>
              {heroBook.title}
            </Text>
            <View style={styles.heroAction}><Ionicons name="play" size={17} color="#fff" /><Text style={styles.heroCta}>Start listening</Text></View>
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
      {upcoming.length ? renderSection("Coming Soon", upcoming, true) : null}
      {renderSection("New Releases", books)}
      {renderSection("Free Books", freeBooks)}
      {renderSection("Premium Books", premiumBooks)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.canvas,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  header: {
    color: Palette.ink, fontSize: 24, lineHeight: 28, fontWeight: "900",
  },
  topBar: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 14 },
  greeting: { color: Palette.muted, fontSize: 12, fontWeight: "600", marginBottom: 1 },
  avatar: { alignItems: "center", backgroundColor: Palette.peach, borderRadius: 22, height: 44, justifyContent: "center", width: 44 },
  searchShortcut: { alignItems: "center", backgroundColor: Palette.paper, borderRadius: 14, flexDirection: "row", gap: 10, marginBottom: 12, paddingHorizontal: 14, paddingVertical: 12 },
  searchShortcutText: { color: Palette.muted, flex: 1, fontSize: 15 },
  filters: {
    gap: 8,
    paddingBottom: 18,
  },
  filter: {
    borderColor: Palette.line,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  filterActive: {
    backgroundColor: Palette.coral,
    borderColor: Palette.coral,
  },
  filterText: {
    color: Palette.ink,
    fontWeight: "700",
  },
  filterTextActive: {
    color: "#FFFFFF",
  },
  hero: {
    height: 230,
    borderRadius: 16,
    marginBottom: 28,
    overflow: "hidden",
    backgroundColor: Palette.paper,
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
    color: "#FFFFFF",
    fontWeight: "800",
  },
  heroAction: { alignItems: "center", alignSelf: "flex-start", backgroundColor: Palette.coral, borderRadius: 24, flexDirection: "row", gap: 7, paddingHorizontal: 16, paddingVertical: 11 },
  section: {
    marginBottom: 22,
  },
  sectionTitle: {
    color: Palette.ink, fontSize: 19, fontWeight: "900",
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
    borderRadius: 18, backgroundColor: Palette.peach,
  },
  emptyShelf: {
    alignItems: "center",
    backgroundColor: Palette.paper, borderRadius: 18,
    height: 90,
    justifyContent: "center",
    paddingHorizontal: 30,
  },
  emptyShelfText: {
    color: Palette.muted,
  },
  error: {
    color: "#B42318",
    marginBottom: 16,
  },
  continueCard: {
    alignItems: "center",
    backgroundColor: Palette.paper, borderRadius: 18,
    flexDirection: "row",
    gap: 12,
    marginBottom: 10,
    padding: 10,
    ...Shadows.soft,
  },
  continueCover: {
    backgroundColor: Palette.peach, borderRadius: 10,
    height: 58,
    width: 44,
  },
  continueText: {
    flex: 1,
  },
  continueTitle: {
    color: Palette.ink,
    fontSize: 15,
    fontWeight: "800",
  },
  continueMeta: {
    color: Palette.muted,
    fontSize: 12,
    marginTop: 3,
  },
  continueProgressTrack: {
    backgroundColor: Palette.line,
    borderRadius: 5,
    height: 7,
    marginTop: 9,
    overflow: "hidden",
  },
  continueProgressFill: {
    backgroundColor: Palette.coral,
    height: "100%",
  },
  continuePercent: { color: Palette.muted, fontSize: 12, fontWeight: "800" },
  continuePlay: { alignItems: "center", backgroundColor: Palette.coral, borderRadius: 20, height: 40, justifyContent: "center", width: 40 },
});
