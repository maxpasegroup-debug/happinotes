import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api } from "@/services/api";
import { PremiumGate } from "@/components/PremiumGate";
import { Book, Chapter } from "@/types/book";
import { UserPalette as Palette, Shadows } from "@/constants/theme";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

type BookDetailResponse = {
  success: boolean;
  book: Book;
  chapters: Chapter[];
};

type ProgressResponse = {
  success: boolean;
  progress: {
    chapterId?: { _id: string } | string;
    completed?: boolean;
  } | null;
};

const formatDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

export default function BookDetail() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [currentChapterId, setCurrentChapterId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setLoading(true);
      setError("");

      const [bookResult, progressResult] = await Promise.all([
        api.get<BookDetailResponse>(`/books/${id}`),
        api.get<ProgressResponse>(`/progress/${id}`),
      ]);

      if (bookResult.success && bookResult.data) {
        setBook(bookResult.data.book);
        setChapters(bookResult.data.chapters);
      } else {
        setError(bookResult.error || "Could not load book.");
      }

      if (progressResult.success && progressResult.data?.progress?.chapterId) {
        const chapter = progressResult.data.progress.chapterId;
        setCurrentChapterId(typeof chapter === "string" ? chapter : chapter._id);
      }

      setLoading(false);
    };

    load();
  }, [id]);

  const introChapter = chapters.find((chapter) => chapter.isFreePreview && chapter.audioUrl);
  const firstPlayableChapter = chapters.find((chapter) => chapter.audioUrl);

  const startListening = () => {
    const chapter = currentChapterId || introChapter?._id || firstPlayableChapter?._id || (book?.introAudioUrl ? "__intro__" : null);
    if (!book || !chapter) return;
    router.push(`/(app)/player?bookId=${book._id}&chapterId=${chapter}`);
  };

  const shareBook = async () => {
    if (!book) return;
    await Share.share({
      message: `Listen to ${book.title} on HappiNotes`,
    });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Loading book...</Text>
      </View>
    );
  }

  if (error || !book) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error || "Book not found."}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}><ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.appBar}><Pressable accessibilityLabel="Go back" style={styles.backButton} onPress={() => router.back()}><Ionicons name="chevron-back" size={25} color={Palette.ink} /></Pressable><Text style={styles.appBarTitle}>Book details</Text><View style={styles.backButton} /></View>
      <View style={styles.header}>
        {book.coverImageUrl ? <Image source={{ uri: book.coverImageUrl }} style={styles.heroBackdrop} blurRadius={24} /> : null}<View style={styles.heroShade} />
        {book.coverImageUrl ? (
          <Image source={{ uri: book.coverImageUrl }} style={styles.cover} contentFit="cover" />
        ) : (
          <View style={[styles.cover, styles.placeholder]}>
            <Text style={styles.placeholderText}>{book.title.slice(0, 1)}</Text>
          </View>
        )}
        <View style={styles.headerText}>
          <Text style={styles.title}>{book.title}</Text>
          <Text style={styles.meta}>
            {book.language.toUpperCase()} - {book.category.toUpperCase()}
          </Text>
          <Text style={styles.duration}>{formatDuration(book.totalDurationSeconds)}</Text>
          <View style={styles.actions}>
            <Pressable style={styles.iconButton} onPress={shareBook}>
              <Ionicons name="share-outline" size={22} color={Palette.ink} />
            </Pressable>
          </View>
        </View>
      </View>

      <Text style={styles.description}>{book.description}</Text>

      {book.introAudioUrl ? (
        <Pressable
          style={styles.intro}
          onPress={() => router.push(`/(app)/player?bookId=${book._id}&chapterId=__intro__`)}
          accessibilityRole="button"
          accessibilityLabel={`Play the introduction to ${book.title}`}
        >
          <Ionicons name="headset-outline" size={22} color="#FF6B4A" />
          <View style={{ flex: 1 }}>
            <Text style={styles.introTitle}>Play Book Audio</Text>
            <Text style={styles.introText}>Tap to listen</Text>
          </View>
          <Ionicons name="play-circle" size={30} color="#FF6B4A" />
        </Pressable>
      ) : null}

      {chapters.some((chapter) => chapter.locked) ? (
        <View style={styles.gateWrap}>
          <PremiumGate message="Upgrade once and listen to every premium chapter in this book." />
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Chapters</Text>
      {chapters.map((chapter) => {
        const active = currentChapterId === chapter._id;
        return (
          <Pressable
            key={chapter._id}
            style={[styles.chapter, active && styles.chapterActive]}
            onPress={() =>
              chapter.audioUrl
                ? router.push(`/(app)/player?bookId=${book._id}&chapterId=${chapter._id}`)
                : router.push("/(app)/subscribe")
            }
          >
            <View style={styles.chapterNumber}>
              <Text style={styles.chapterNumberText}>{chapter.chapterNumber}</Text>
            </View>
            <View style={styles.chapterText}>
              <Text style={styles.chapterTitle}>{chapter.title}</Text>
              <Text style={styles.chapterMeta}>{formatDuration(chapter.durationSeconds)}</Text>
            </View>
            {chapter.locked ? (
              <View style={styles.lockWrap}>
                <Ionicons name="lock-closed" size={18} color="#B54708" />
                <Text style={styles.lockText}>Go Premium</Text>
              </View>
            ) : active ? (
              <Ionicons name="checkmark-circle" size={22} color="#067647" />
            ) : (
              <Ionicons name="play-circle-outline" size={24} color="#FF6B4A" />
            )}
          </Pressable>
        );
      })}
    </ScrollView><View style={[styles.stickyAction, { bottom: 68 + insets.bottom }]}><Pressable style={styles.stickyButton} onPress={startListening}><Ionicons name="play" size={21} color="#fff" /><Text style={styles.primaryButtonText}>{currentChapterId ? "Resume Listening" : "Start Listening"}</Text></Pressable></View></SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.canvas,
  },
  safe: { flex: 1, backgroundColor: Palette.canvas },
  appBar: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  appBarTitle: { color: Palette.ink, fontSize: 17, fontWeight: "800" },
  backButton: { alignItems: "center", height: 42, justifyContent: "center", width: 42 },
  content: {
    padding: 20,
    paddingTop: 16, paddingBottom: 120,
  },
  center: {
    alignItems: "center",
    backgroundColor: Palette.canvas,
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  header: {
    alignItems: "center", borderRadius: 20, gap: 14, minHeight: 390, overflow: "hidden", padding: 22,
  },
  heroBackdrop: { ...StyleSheet.absoluteFillObject },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(17,17,17,.72)" },
  cover: {
    width: 164,
    height: 232,
    borderRadius: 18, backgroundColor: Palette.peach, ...Shadows.soft,
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Palette.peach,
  },
  placeholderText: {
    color: Palette.coral,
    fontSize: 48,
    fontWeight: "900",
  },
  headerText: {
    alignItems: "center", width: "100%",
  },
  title: {
    color: Palette.ink, fontSize: 24, textAlign: "center",
    fontWeight: "900",
  },
  meta: {
    color: Palette.coralDark,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 10,
  },
  duration: {
    color: Palette.muted,
    fontSize: 14,
    marginTop: 8,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 18,
  },
  stickyAction: { backgroundColor: Palette.canvas, borderTopColor: Palette.line, borderTopWidth: 1, bottom: 0, left: 0, padding: 12, position: "absolute", right: 0 },
  stickyButton: { alignItems: "center", backgroundColor: Palette.coral, borderRadius: 16, flexDirection: "row", gap: 9, justifyContent: "center", paddingVertical: 15 },
  primaryButton: {
    alignItems: "center",
    backgroundColor: Palette.coral, borderRadius: 22,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  iconButton: {
    alignItems: "center",
    borderColor: Palette.line, borderRadius: 18,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  description: {
    color: Palette.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 24,
  },
  intro: {
    alignItems: "center",
    backgroundColor: Palette.peach, borderRadius: 18,
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
    padding: 16,
  },
  introTitle: {
    color: Palette.ink,
    fontWeight: "800",
  },
  introText: {
    color: Palette.muted,
    marginTop: 2,
  },
  gateWrap: {
    marginTop: 18,
  },
  sectionTitle: {
    color: Palette.ink,
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 12,
    marginTop: 28,
  },
  chapter: {
    alignItems: "center",
    borderBottomColor: Palette.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingVertical: 14,
  },
  chapterActive: {
    backgroundColor: Palette.sage,
  },
  chapterNumber: {
    alignItems: "center",
    backgroundColor: Palette.peach, borderRadius: 12,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  chapterNumberText: {
    color: Palette.ink,
    fontWeight: "900",
  },
  chapterText: {
    flex: 1,
  },
  chapterTitle: {
    color: Palette.ink,
    fontSize: 15,
    fontWeight: "800",
  },
  chapterMeta: {
    color: "#667085",
    fontSize: 12,
    marginTop: 4,
  },
  lockWrap: {
    alignItems: "center",
    gap: 3,
  },
  lockText: {
    color: "#B54708",
    fontSize: 10,
    fontWeight: "800",
  },
  muted: {
    color: "#667085",
  },
  error: {
    color: "#B42318",
    textAlign: "center",
  },
});
