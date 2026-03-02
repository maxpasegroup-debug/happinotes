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
import { Audio } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import {
  addToFavourites,
  getFavourites,
  getSilence,
  removeFromFavourites,
} from "../../services/api";
import { getToken } from "../../services/authStorage";
import type { ApiContent } from "../../services/api";

export default function SilenceScreen() {
  const [contents, setContents] = useState<ApiContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [addingFavId, setAddingFavId] = useState<string | null>(null);
  const [favouriteIds, setFavouriteIds] = useState<Set<string>>(new Set());
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
    async (mediaUrl: string, contentId: string) => {
      if (!mediaUrl?.trim()) {
        Alert.alert("Playback", "Audio is not available for this session.");
        return;
      }
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
        setPlayingId(contentId);
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
      try {
        const token = await getToken();
        const response = await getSilence(token ?? undefined);
        if (!cancelled) {
          setContents(response.contents ?? []);
        }
        if (token && !cancelled) {
          try {
            const res = await getFavourites(token);
            setFavouriteIds(new Set((res.favourites ?? []).map((f) => f._id)));
          } catch (_) {}
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "Failed to load silence sessions";
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

  useEffect(() => {
    return () => {
      stopCurrent();
    };
  }, [stopCurrent]);

  const toggleFavourite = useCallback(async (contentId: string) => {
    const token = await getToken();
    if (!token) {
      Alert.alert("Sign in required", "Please sign in to add favourites.");
      return;
    }
    setAddingFavId(contentId);
    try {
      const isFav = favouriteIds.has(contentId);
      if (isFav) {
        await removeFromFavourites(contentId, token);
        setFavouriteIds((prev) => {
          const next = new Set(prev);
          next.delete(contentId);
          return next;
        });
      } else {
        await addToFavourites(contentId, token);
        setFavouriteIds((prev) => new Set(prev).add(contentId));
      }
    } catch (err) {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Could not update favourites"
      );
    } finally {
      setAddingFavId(null);
    }
  }, [favouriteIds]);

  if (loading) {
    return (
      <View style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#7C7C7C" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.safeArea}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Silence</Text>
        <Text style={styles.subtitle}>Pause. Breathe. Reset.</Text>

        {contents.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>
              Silence sessions launching soon.
            </Text>
          </View>
        ) : (
          contents.map((item) => {
            const mediaUrl = (item as ApiContent & { mediaUrl?: string })
              .mediaUrl;
            const isPlaying = playingId === item._id;
            const isFav = favouriteIds.has(item._id);

            return (
              <View key={item._id} style={styles.card}>
                <View style={styles.thumbWrap}>
                  <Image
                    source={{ uri: item.thumbnailUrl }}
                    style={styles.thumbnail}
                    contentFit="cover"
                  />
                  <Pressable
                    style={styles.heartIcon}
                    onPress={() => toggleFavourite(item._id)}
                    disabled={addingFavId === item._id}
                  >
                    <Ionicons
                      name={isFav ? "heart" : "heart-outline"}
                      size={18}
                      color={isFav ? "#FF6B4A" : "#6B7280"}
                    />
                  </Pressable>
                </View>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                {item.description ? (
                  <Text
                    style={styles.cardDescription}
                    numberOfLines={2}
                    ellipsizeMode="tail"
                  >
                    {item.description}
                  </Text>
                ) : null}
                <View style={styles.playWrap}>
                  <Pressable
                    style={styles.playButton}
                    onPress={() =>
                      isPlaying
                        ? stopCurrent()
                        : play(mediaUrl ?? "", item._id)
                    }
                  >
                    <Ionicons
                      name={isPlaying ? "pause" : "play"}
                      size={28}
                      color="#fff"
                    />
                  </Pressable>
                </View>
                <Pressable
                  style={[
                    styles.favButton,
                    addingFavId === item._id && styles.favButtonDisabled,
                  ]}
                  onPress={() => toggleFavourite(item._id)}
                  disabled={addingFavId === item._id}
                >
                  <Ionicons
                    name={isFav ? "heart" : "heart-outline"}
                    size={18}
                    color={isFav ? "#FF6B4A" : "#6B7280"}
                  />
                  <Text style={styles.favButtonText}>Add to Favourites</Text>
                </Pressable>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#6B7280",
    marginBottom: 28,
    letterSpacing: 0.3,
  },
  emptyWrap: {
    paddingVertical: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 17,
    fontWeight: "500",
    color: "#6B7280",
    textAlign: "center",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 24,
    paddingBottom: 20,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  thumbWrap: {
    width: "100%",
    position: "relative",
  },
  thumbnail: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: "#E8E8E8",
  },
  heartIcon: {
    position: "absolute",
    top: 8,
    right: 8,
    padding: 6,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#374151",
    textAlign: "center",
    marginTop: 20,
    marginHorizontal: 16,
  },
  cardDescription: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 20,
    textAlign: "center",
    marginTop: 8,
    marginHorizontal: 20,
  },
  playWrap: {
    alignItems: "center",
    marginTop: 20,
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#9CA3AF",
    justifyContent: "center",
    alignItems: "center",
  },
  favButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 20,
    marginHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#F5F5F5",
  },
  favButtonDisabled: {
    opacity: 0.7,
  },
  favButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
  },
});
