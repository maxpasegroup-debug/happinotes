import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  SafeAreaView,
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
  getNotes,
  removeFromFavourites,
} from "../../services/api";
import { getToken } from "../../services/authStorage";
import type { ApiContent } from "../../services/api";

export default function NotesScreen() {
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
        Alert.alert("Playback", "Audio is not available for this note.");
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
        const response = await getNotes(token ?? undefined);
        if (!cancelled) {
          setContents(response.contents ?? []);
        }
        if (token && !cancelled) {
          const res = await getFavourites(token);
          setFavouriteIds(new Set((res.favourites ?? []).map((f) => f._id)));
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "Failed to load notes";
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
        <Text style={styles.header}>Notes</Text>

        <FlatList
          data={contents}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          listEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>Notes launching soon.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const mediaUrl = (item as ApiContent & { mediaUrl?: string })
              .mediaUrl;
            const isPlaying = playingId === item._id;
            const isFav = favouriteIds.has(item._id);

            return (
              <View style={styles.card}>
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
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text
                    style={styles.cardDescription}
                    numberOfLines={2}
                    ellipsizeMode="tail"
                  >
                    {item.description || ""}
                  </Text>
                  <View style={styles.cardActions}>
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
                        size={24}
                        color="#fff"
                      />
                    </Pressable>
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
                        size={20}
                        color={isFav ? "#FF6B4A" : "#6B7280"}
                      />
                      <Text style={styles.favButtonText}>Favourites</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 20,
  },
  listContent: {
    paddingBottom: 24,
    flexGrow: 1,
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
    color: "#6B7280",
    textAlign: "center",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  thumbWrap: {
    width: "100%",
    position: "relative",
  },
  thumbnail: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: "#E5E7EB",
  },
  heartIcon: {
    position: "absolute",
    top: 8,
    right: 8,
    padding: 6,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  cardBody: {
    padding: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 6,
  },
  cardDescription: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 20,
    marginBottom: 14,
  },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FF6B4A",
    justifyContent: "center",
    alignItems: "center",
  },
  favButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "#FFF5F2",
  },
  favButtonDisabled: {
    opacity: 0.7,
  },
  favButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FF6B4A",
  },
});
