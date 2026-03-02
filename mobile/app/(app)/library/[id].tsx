import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { Audio } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import {
  addToFavourites,
  getContentById,
  getFavourites,
  removeFromFavourites,
} from "../../../services/api";
import { getToken as getStoredToken } from "../../../services/authStorage";
import type { ContentDetail, LifebookLesson } from "../../../services/api";

type PlayingId = "intro" | `lesson-${number}` | "conclusion" | null;

export default function LifebookDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [content, setContent] = useState<ContentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingFav, setAddingFav] = useState(false);
  const [isFavourited, setIsFavourited] = useState(false);
  const [playingId, setPlayingId] = useState<PlayingId>(null);
  const currentSoundRef = useRef<Audio.Sound | null>(null);

  const stopCurrent = useCallback(async () => {
    const sound = currentSoundRef.current;
    if (sound) {
      try {
        await sound.stopAsync();
        await sound.unloadAsync();
      } catch (_) {}
      currentSoundRef.current = null;
      setPlayingId(null);
    }
  }, []);

  const play = useCallback(
    async (mediaUrl: string, newId: PlayingId) => {
      if (!mediaUrl?.trim()) return;
      await stopCurrent();
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
        const { sound } = await Audio.Sound.createAsync(
          { uri: mediaUrl },
          { shouldPlay: true }
        );
        currentSoundRef.current = sound;
        setPlayingId(newId);
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish && !status.isPlaying) {
            stopCurrent();
          }
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Playback failed";
        Alert.alert("Playback error", msg);
      }
    },
    [stopCurrent]
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!id) {
        if (!cancelled) setError("Missing lifebook id");
        setLoading(false);
        return;
      }
      try {
        const token = await getStoredToken();
        const [contentRes, favRes] = await Promise.all([
          getContentById(id, token ?? undefined),
          token ? getFavourites(token).catch(() => ({ success: true as const, favourites: [] })) : Promise.resolve({ success: true as const, favourites: [] }),
        ]);
        if (!cancelled) {
          setContent(contentRes.content);
          setError(null);
          const ids = new Set((favRes.favourites ?? []).map((f) => f._id));
          setIsFavourited(ids.has(id));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
          setContent(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    return () => {
      stopCurrent();
    };
  }, [stopCurrent]);

  const toggleFavourite = useCallback(async () => {
    if (!id) return;
    const token = await getStoredToken();
    if (!token) {
      Alert.alert("Sign in required", "Please sign in to add favourites.");
      return;
    }
    setAddingFav(true);
    try {
      if (isFavourited) {
        await removeFromFavourites(id, token);
        setIsFavourited(false);
      } else {
        await addToFavourites(id, token);
        setIsFavourited(true);
      }
    } catch (err) {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Could not update favourites"
      );
    } finally {
      setAddingFav(false);
    }
  }, [id, isFavourited]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error || !content) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error ?? "Content not found"}</Text>
      </View>
    );
  }

  const intro = content.intro;
  const lessons = (content.lessons ?? []) as LifebookLesson[];
  const conclusion = content.conclusion;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.thumbWrap}>
        <Image
          source={{ uri: content.thumbnailUrl }}
          style={styles.thumbnail}
          contentFit="cover"
        />
      </View>
      <Text style={styles.title}>{content.title}</Text>
      {content.description ? (
        <Text style={styles.description}>{content.description}</Text>
      ) : null}

      {intro ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Introduction</Text>
          <Pressable
            style={styles.playButton}
            onPress={() =>
              playingId === "intro"
                ? stopCurrent()
                : play(intro.mediaUrl, "intro")
            }
          >
            <Ionicons
              name={playingId === "intro" ? "pause" : "play"}
              size={28}
              color="#fff"
            />
          </Pressable>
        </View>
      ) : null}

      {lessons.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lessons</Text>
          {lessons
            .slice()
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            .map((lesson, index) => (
              <View key={`${lesson.order}-${index}`} style={styles.lessonRow}>
                <Text style={styles.lessonTitle} numberOfLines={1}>
                  {lesson.title}
                </Text>
                {lesson.mediaUrl ? (
                  <Pressable
                    style={styles.smallPlay}
                    onPress={() =>
                      playingId === `lesson-${index}`
                        ? stopCurrent()
                        : play(
                            lesson.mediaUrl,
                            `lesson-${index}` as PlayingId
                          )
                    }
                  >
                    <Ionicons
                      name={
                        playingId === `lesson-${index}` ? "pause" : "play"
                      }
                      size={18}
                      color="#fff"
                    />
                  </Pressable>
                ) : null}
                {lesson.duration != null ? (
                  <Text style={styles.duration}>{lesson.duration}</Text>
                ) : null}
              </View>
            ))}
        </View>
      ) : null}

      {conclusion ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Conclusion</Text>
          <Pressable
            style={styles.playButton}
            onPress={() =>
              playingId === "conclusion"
                ? stopCurrent()
                : play(conclusion.mediaUrl, "conclusion")
            }
          >
            <Ionicons
              name={playingId === "conclusion" ? "pause" : "play"}
              size={28}
              color="#fff"
            />
          </Pressable>
        </View>
      ) : null}

      <Pressable
        style={[styles.favButton, addingFav && styles.favButtonDisabled]}
        onPress={toggleFavourite}
        disabled={addingFav}
      >
        <Ionicons
          name={isFavourited ? "heart" : "heart-outline"}
          size={20}
          color="#fff"
          style={{ marginRight: 8 }}
        />
        <Text style={styles.favButtonText}>
          {addingFav
            ? "…"
            : isFavourited
              ? "Remove from Favourites"
              : "Add to Favourites"}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  errorText: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
  },
  thumbWrap: {
    width: "100%",
    marginBottom: 16,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#E5E7EB",
  },
  thumbnail: {
    width: "100%",
    aspectRatio: 3 / 4,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: "#4B5563",
    lineHeight: 24,
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 12,
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FF6B4A",
    justifyContent: "center",
    alignItems: "center",
  },
  lessonRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 12,
  },
  lessonTitle: {
    flex: 1,
    fontSize: 16,
    color: "#1F2937",
  },
  smallPlay: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FF6B4A",
    justifyContent: "center",
    alignItems: "center",
  },
  duration: {
    fontSize: 14,
    color: "#6B7280",
    minWidth: 48,
    textAlign: "right",
  },
  favButton: {
    flexDirection: "row",
    backgroundColor: "#FF6B4A",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  favButtonDisabled: {
    opacity: 0.7,
  },
  favButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
});
