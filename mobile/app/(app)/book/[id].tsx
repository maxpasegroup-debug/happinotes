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
import { Book, Chapter } from "@/types/book";

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
    const chapter = currentChapterId || introChapter?._id || firstPlayableChapter?._id;
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
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
            {book.language.toUpperCase()} · {book.category.toUpperCase()}
          </Text>
          <Text style={styles.duration}>{formatDuration(book.totalDurationSeconds)}</Text>
          <View style={styles.actions}>
            <Pressable style={styles.primaryButton} onPress={startListening}>
              <Ionicons name="play" size={18} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Start Listening</Text>
            </Pressable>
            <Pressable style={styles.iconButton} onPress={shareBook}>
              <Ionicons name="share-outline" size={22} color="#344054" />
            </Pressable>
          </View>
        </View>
      </View>

      <Text style={styles.description}>{book.description}</Text>

      {book.introAudioUrl ? (
        <View style={styles.intro}>
          <Ionicons name="headset-outline" size={22} color="#FF6B4A" />
          <View>
            <Text style={styles.introTitle}>Intro Preview</Text>
            <Text style={styles.introText}>Always unlocked</Text>
          </View>
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
  center: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  header: {
    flexDirection: "row",
    gap: 18,
  },
  cover: {
    width: 132,
    height: 186,
    borderRadius: 8,
    backgroundColor: "#EFEFEF",
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFE8E1",
  },
  placeholderText: {
    color: "#FF6B4A",
    fontSize: 48,
    fontWeight: "900",
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: "#181818",
    fontSize: 25,
    fontWeight: "900",
  },
  meta: {
    color: "#667085",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 10,
  },
  duration: {
    color: "#344054",
    fontSize: 14,
    marginTop: 8,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#FF6B4A",
    borderRadius: 8,
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
    borderColor: "#D0D5DD",
    borderRadius: 8,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  description: {
    color: "#344054",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 24,
  },
  intro: {
    alignItems: "center",
    backgroundColor: "#FFF5F1",
    borderRadius: 8,
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
    padding: 16,
  },
  introTitle: {
    color: "#181818",
    fontWeight: "800",
  },
  introText: {
    color: "#667085",
    marginTop: 2,
  },
  sectionTitle: {
    color: "#181818",
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 12,
    marginTop: 28,
  },
  chapter: {
    alignItems: "center",
    borderBottomColor: "#EAECF0",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingVertical: 14,
  },
  chapterActive: {
    backgroundColor: "#F6FEF9",
  },
  chapterNumber: {
    alignItems: "center",
    backgroundColor: "#F2F4F7",
    borderRadius: 8,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  chapterNumberText: {
    color: "#344054",
    fontWeight: "900",
  },
  chapterText: {
    flex: 1,
  },
  chapterTitle: {
    color: "#181818",
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
