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
import { getContentById } from "../../../services/api";
import { getToken as getStoredToken } from "../../../services/authStorage";
import type { ContentDetail } from "../../../services/api";

export default function ContentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [content, setContent] = useState<ContentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const currentSoundRef = useRef<Audio.Sound | null>(null);

  const stopCurrent = useCallback(async () => {
    const sound = currentSoundRef.current;
    if (sound) {
      try {
        await sound.stopAsync();
        await sound.unloadAsync();
      } catch (_) {}
      currentSoundRef.current = null;
      setPlaying(false);
    }
  }, []);

  const play = useCallback(async () => {
    const mediaUrl = (content as ContentDetail & { mediaUrl?: string })?.mediaUrl;
    if (!mediaUrl?.trim()) {
      Alert.alert("Playback", "Audio is not available.");
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
      setPlaying(true);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish && !status.isPlaying) {
          stopCurrent();
        }
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Playback failed";
      Alert.alert("Playback error", msg);
    }
  }, [content, stopCurrent]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!id) {
        if (!cancelled) setError("Missing content id");
        setLoading(false);
        return;
      }
      try {
        const token = await getStoredToken();
        const res = await getContentById(id, token ?? undefined);
        if (!cancelled) {
          setContent(res.content);
          setError(null);
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
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    return () => { stopCurrent(); };
  }, [stopCurrent]);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  if (error || !content) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>{error ?? "Content not found"}</Text>
      </View>
    );
  }

  const mediaUrl = (content as ContentDetail & { mediaUrl?: string }).mediaUrl;

  return (
    <ScrollView
      style={styles.container}
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
      {mediaUrl ? (
        <Pressable
          style={styles.playButton}
          onPress={() => (playing ? stopCurrent() : play())}
        >
          <Ionicons name={playing ? "pause" : "play"} size={28} color="#fff" />
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  scrollContent: { padding: 24, paddingBottom: 40 },
  centered: { justifyContent: "center", alignItems: "center" },
  errorText: { fontSize: 16, color: "#6B7280", textAlign: "center" },
  thumbWrap: {
    width: "100%",
    marginBottom: 16,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#E5E7EB",
  },
  thumbnail: { width: "100%", aspectRatio: 16 / 9 },
  title: { fontSize: 22, fontWeight: "700", color: "#1F2937", marginBottom: 8 },
  description: { fontSize: 16, color: "#4B5563", lineHeight: 24 },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FF6B4A",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 24,
  },
});
