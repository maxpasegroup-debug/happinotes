import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { usePlayer } from "@/store/playerStore";

export function MiniPlayer() {
  const router = useRouter();
  const { currentTrack, isPlaying, togglePlayback } = usePlayer();

  if (!currentTrack) return null;

  return (
    <Pressable
      style={styles.container}
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
    backgroundColor: "#181818",
    borderTopColor: "rgba(255,255,255,0.08)",
    borderTopWidth: 1,
    bottom: 76,
    flexDirection: "row",
    gap: 12,
    left: 12,
    minHeight: 64,
    padding: 10,
    position: "absolute",
    right: 12,
    zIndex: 10,
    borderRadius: 8,
  },
  cover: {
    borderRadius: 6,
    height: 44,
    width: 44,
  },
  coverPlaceholder: {
    backgroundColor: "#FF6B4A",
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
    color: "#D0D5DD",
    fontSize: 12,
    marginTop: 2,
  },
  button: {
    alignItems: "center",
    backgroundColor: "#FF6B4A",
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
});
