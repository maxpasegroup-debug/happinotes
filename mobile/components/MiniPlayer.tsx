import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { usePlayer } from "@/store/playerStore";
import { UserPalette as Palette, Shadows } from "@/constants/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function MiniPlayer() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentTrack, isPlaying, togglePlayback } = usePlayer();

  if (!currentTrack) return null;

  return (
    <Pressable
      style={[styles.container, { bottom: 68 + insets.bottom }]}
      onPress={() =>
        router.push(
          `/(app)/player?bookId=${currentTrack.book._id}&chapterId=${currentTrack.chapter._id}`
        )
      }
    >
      {currentTrack.book.coverImageUrl ? (
        <Image
          source={{ uri: currentTrack.book.coverImageUrl }}
          style={styles.cover}
          contentFit="cover"
        />
      ) : (
        <View style={styles.coverPlaceholder} />
      )}
      <View style={styles.textWrap}>
        <Text style={styles.chapter} numberOfLines={1}>
          {currentTrack.chapter.title}
        </Text>
        <Text style={styles.book} numberOfLines={1}>
          {currentTrack.book.title}
        </Text>
      </View>
      <Pressable
        style={styles.button}
        onPress={(event) => {
          event.stopPropagation();
          void togglePlayback();
        }}
      >
        <Ionicons name={isPlaying ? "pause" : "play"} size={22} color="#FFFFFF" />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: Palette.paper,
    borderTopColor: "rgba(255,255,255,0.08)",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 12,
    left: 0,
    minHeight: 64,
    padding: 10,
    position: "absolute",
    right: 0,
    zIndex: 10,
    borderRadius: 0,
    ...Shadows.soft,
  },
  cover: {
    borderRadius: 6,
    height: 44,
    width: 44,
  },
  coverPlaceholder: {
    backgroundColor: Palette.coral,
    borderRadius: 6,
    height: 44,
    width: 44,
  },
  textWrap: {
    flex: 1,
  },
  chapter: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  book: {
    color: Palette.muted,
    fontSize: 12,
    marginTop: 2,
  },
  button: {
    alignItems: "center",
    backgroundColor: Palette.coral,
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
});
