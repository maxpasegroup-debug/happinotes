import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "@/services/api";
import { PremiumGate } from "@/components/PremiumGate";
import { usePlayer } from "@/store/playerStore";
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
    positionSeconds?: number;
  } | null;
};

const speeds = [0.75, 1, 1.25, 1.5, 2];
const sleepOptions = [15, 30, 45, 60];

const formatTime = (millis: number) => {
  const totalSeconds = Math.max(0, Math.floor(millis / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

export default function PlayerScreen() {
  const router = useRouter();
  const { bookId, chapterId } = useLocalSearchParams<{
    bookId: string;
    chapterId: string;
  }>();
  const {
    currentTrack,
    isPlaying,
    positionMillis,
    durationMillis,
    playbackRate,
    volume,
    sleepTimerMinutes,
    playbackError,
    playTrack,
    togglePlayback,
    stopPlayback,
    seekTo,
    skipToChapter,
    setPlaybackRate,
    setVolumeLevel,
    setSleepTimer,
    saveProgressNow,
  } = usePlayer();

  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!bookId || !chapterId) return;
      setError("");

      const [bookResult, progressResult] = await Promise.all([
        api.get<BookDetailResponse>(`/books/${bookId}`),
        api.get<ProgressResponse>(`/progress/${bookId}`),
      ]);

      if (!bookResult.success || !bookResult.data) {
        setError(bookResult.error || "Could not load audio.");
        return;
      }

      const nextBook = bookResult.data.book;
      const introChapter: Chapter | null = nextBook.introAudioUrl
        ? {
            _id: "__intro__",
            bookId: nextBook._id,
            title: "Book Audio",
            chapterNumber: 0,
            description: "Main book audio",
            audioUrl: nextBook.introAudioUrl,
            durationSeconds: 0,
            isFreePreview: true,
          }
        : null;
      const nextChapters = introChapter
        ? [introChapter, ...bookResult.data.chapters]
        : bookResult.data.chapters;
      const nextChapter = nextChapters.find((chapter) => chapter._id === chapterId);

      if (!nextChapter?.audioUrl) {
        setError("This chapter is locked. Upgrade to Premium to listen.");
        return;
      }

      setBook(nextBook);
      setChapters(nextChapters);

      const progress = chapterId === "__intro__" ? null : progressResult.data?.progress;
      const progressChapter = progress?.chapterId;
      const progressChapterId =
        typeof progressChapter === "string" ? progressChapter : progressChapter?._id;
      const startPosition =
        progressChapterId === chapterId && progress?.positionSeconds ? progress.positionSeconds : 0;

      if (currentTrack?.chapter._id !== chapterId) {
        await playTrack(
          {
            book: nextBook,
            chapter: nextChapter,
            chapters: nextChapters,
          },
          startPosition
        );
      }
    };

    load();
  }, [bookId, chapterId, currentTrack?.chapter._id, playTrack]);

  useEffect(() => {
    return () => {
      void saveProgressNow();
    };
  }, [saveProgressNow]);

  const activeBook = currentTrack?.book || book;
  const activeChapter = currentTrack?.chapter || chapters.find((chapter) => chapter._id === chapterId);
  const activeChapters = currentTrack?.chapters || chapters;

  const currentIndex = useMemo(
    () => activeChapters.findIndex((chapter) => chapter._id === activeChapter?._id),
    [activeChapter?._id, activeChapters]
  );
  const previousChapter = [...activeChapters]
    .slice(0, Math.max(0, currentIndex))
    .reverse()
    .find((chapter) => chapter.audioUrl);
  const nextChapter = activeChapters.slice(currentIndex + 1).find((chapter) => chapter.audioUrl);
  const progressPercent = durationMillis ? Math.min(1, positionMillis / durationMillis) : 0;

  const seekByPercent = async (percent: number) => {
    if (!durationMillis) return;
    await seekTo(durationMillis * percent);
  };

  if (error) {
    return (
      <View style={styles.center}>
        {error.includes("locked") ? (
          <PremiumGate />
        ) : (
          <Text style={styles.error}>{error}</Text>
        )}
        <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
          <Text style={styles.secondaryButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  if (!activeBook || !activeChapter) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Loading player...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.artWrap}>
        {activeBook.coverImageUrl ? (
          <Image source={{ uri: activeBook.coverImageUrl }} style={styles.background} blurRadius={28} />
        ) : null}
        <View style={styles.backgroundShade} />
        {activeBook.coverImageUrl ? (
          <Image source={{ uri: activeBook.coverImageUrl }} style={styles.cover} contentFit="cover" />
        ) : (
          <View style={styles.cover} />
        )}
      </View>

      <Text style={styles.chapterTitle}>{activeChapter.title}</Text>
      <Text style={styles.bookTitle}>{activeBook.title}</Text>
      {playbackError ? <Text accessibilityRole="alert" style={styles.playbackError}>{playbackError}</Text> : null}

      <Pressable
        style={styles.progressTrack}
        onPress={(event) => {
          const { locationX } = event.nativeEvent;
          void seekByPercent(locationX / 320);
        }}
      >
        <View style={[styles.progressFill, { width: `${progressPercent * 100}%` }]} />
      </Pressable>
      <View style={styles.timeRow}>
        <Text style={styles.time}>{formatTime(positionMillis)}</Text>
        <Text style={styles.time}>{formatTime(durationMillis)}</Text>
      </View>

      <View style={styles.transport}>
        <Pressable
          style={[styles.skipButton, !previousChapter && styles.disabled]}
          disabled={!previousChapter}
          onPress={() => previousChapter && skipToChapter(previousChapter._id)}
        >
          <Ionicons name="play-skip-back" size={24} color="#344054" />
        </Pressable>
        <Pressable
          accessibilityLabel={isPlaying ? "Stop audio" : "Play audio"}
          style={styles.playButton}
          onPress={() => (isPlaying ? stopPlayback() : togglePlayback())}
        >
          <Ionicons name={isPlaying ? "stop" : "play"} size={34} color="#FFFFFF" />
        </Pressable>
        <Pressable
          style={[styles.skipButton, !nextChapter && styles.disabled]}
          disabled={!nextChapter}
          onPress={() => nextChapter && skipToChapter(nextChapter._id)}
        >
          <Ionicons name="play-skip-forward" size={24} color="#344054" />
        </Pressable>
      </View>

      <Text style={styles.controlLabel}>Speed</Text>
      <View style={styles.segmentRow}>
        {speeds.map((speed) => (
          <Pressable
            key={speed}
            style={[styles.segment, playbackRate === speed && styles.segmentActive]}
            onPress={() => setPlaybackRate(speed)}
          >
            <Text style={[styles.segmentText, playbackRate === speed && styles.segmentTextActive]}>
              {speed}x
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.controlLabel}>Volume</Text>
      <View style={styles.volumeRow}>
        <Ionicons name="volume-low" size={22} color="#667085" />
        {[0.25, 0.5, 0.75, 1].map((level) => (
          <Pressable
            key={level}
            style={[styles.volumeStep, volume >= level && styles.volumeStepActive]}
            onPress={() => setVolumeLevel(level)}
          />
        ))}
        <Ionicons name="volume-high" size={22} color="#667085" />
      </View>

      <Text style={styles.controlLabel}>Sleep Timer</Text>
      <View style={styles.segmentRow}>
        <Pressable
          style={[styles.segment, sleepTimerMinutes === null && styles.segmentActive]}
          onPress={() => setSleepTimer(null)}
        >
          <Text style={[styles.segmentText, sleepTimerMinutes === null && styles.segmentTextActive]}>
            Off
          </Text>
        </Pressable>
        {sleepOptions.map((minutes) => (
          <Pressable
            key={minutes}
            style={[styles.segment, sleepTimerMinutes === minutes && styles.segmentActive]}
            onPress={() => setSleepTimer(minutes)}
          >
            <Text
              style={[styles.segmentText, sleepTimerMinutes === minutes && styles.segmentTextActive]}
            >
              {minutes}m
            </Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  content: {
    paddingBottom: 160,
  },
  center: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  artWrap: {
    alignItems: "center",
    height: 390,
    justifyContent: "flex-end",
    overflow: "hidden",
    paddingBottom: 34,
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  backgroundShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.46)",
  },
  cover: {
    backgroundColor: "#FFE8E1",
    borderRadius: 8,
    height: 250,
    width: 178,
  },
  chapterTitle: {
    color: "#181818",
    fontSize: 25,
    fontWeight: "900",
    marginTop: 26,
    paddingHorizontal: 24,
    textAlign: "center",
  },
  bookTitle: {
    color: "#667085",
    fontSize: 15,
    fontWeight: "700",
    marginTop: 8,
    paddingHorizontal: 24,
    textAlign: "center",
  },
  progressTrack: {
    alignSelf: "center",
    backgroundColor: "#EAECF0",
    borderRadius: 6,
    height: 10,
    marginTop: 28,
    overflow: "hidden",
    marginHorizontal: 24,
    maxWidth: 320,
    width: "86%",
  },
  progressFill: {
    backgroundColor: "#FF6B4A",
    height: "100%",
  },
  timeRow: {
    alignSelf: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    maxWidth: 320,
    width: "86%",
  },
  time: {
    color: "#667085",
    fontSize: 12,
    fontWeight: "700",
  },
  transport: {
    alignItems: "center",
    flexDirection: "row",
    gap: 28,
    justifyContent: "center",
    marginTop: 26,
  },
  playButton: {
    alignItems: "center",
    backgroundColor: "#FF6B4A",
    borderRadius: 36,
    height: 72,
    justifyContent: "center",
    width: 72,
  },
  skipButton: {
    alignItems: "center",
    backgroundColor: "#F2F4F7",
    borderRadius: 26,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  disabled: {
    opacity: 0.35,
  },
  controlLabel: {
    color: "#181818",
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 12,
    marginTop: 28,
    paddingHorizontal: 24,
  },
  segmentRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 24,
  },
  segment: {
    borderColor: "#D0D5DD",
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 58,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  segmentActive: {
    backgroundColor: "#FF6B4A",
    borderColor: "#FF6B4A",
  },
  segmentText: {
    color: "#344054",
    fontWeight: "800",
    textAlign: "center",
  },
  segmentTextActive: {
    color: "#FFFFFF",
  },
  volumeRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 24,
  },
  volumeStep: {
    backgroundColor: "#EAECF0",
    borderRadius: 5,
    flex: 1,
    height: 10,
  },
  volumeStepActive: {
    backgroundColor: "#FF6B4A",
  },
  secondaryButton: {
    borderColor: "#D0D5DD",
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 18,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  secondaryButtonText: {
    color: "#344054",
    fontWeight: "800",
  },
  error: {
    color: "#B42318",
    fontWeight: "700",
    textAlign: "center",
  },
  playbackError: {
    color: "#B42318",
    fontSize: 13,
    fontWeight: "700",
    marginHorizontal: 24,
    marginTop: 14,
    textAlign: "center",
  },
  muted: {
    color: "#667085",
  },
});
