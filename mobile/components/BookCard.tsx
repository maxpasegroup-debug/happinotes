import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Book } from "@/types/book";
import { UserPalette as Palette } from "@/constants/theme";

type Props = {
  book: Book;
  onPress: () => void;
  layout?: "shelf" | "grid";
};

const formatDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

export function BookCard({ book, onPress, layout = "shelf" }: Props) {
  const grid = layout === "grid";
  return (
    <Pressable style={[styles.card, grid && styles.gridCard]} onPress={onPress}>
      <View style={[styles.coverWrap, grid && styles.gridCover]}>
        {book.coverImageUrl ? (
          <Image source={{ uri: book.coverImageUrl }} style={styles.cover} contentFit="cover" />
        ) : (
          <View style={[styles.cover, styles.placeholder]}>
            <Text style={styles.placeholderText}>{book.title.slice(0, 1)}</Text>
          </View>
        )}
        {book.status === "upcoming" ? (
          <View style={styles.overlay}>
            <Text style={styles.overlayText}>UPCOMING</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {book.title}
      </Text>
      <View style={styles.badges}>
        <Text style={styles.language}>{book.language.toUpperCase()}</Text>
        <Text style={book.accessType === "premium" ? styles.premium : styles.free}>
          {book.accessType.toUpperCase()}
        </Text>
      </View>
      <Text style={styles.duration}>{formatDuration(book.totalDurationSeconds)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 138,
    marginRight: 12,
    backgroundColor: "transparent",
  },
  gridCard: {
    flex: 1,
    marginRight: 0,
    width: undefined,
  },
  coverWrap: {
    width: "100%",
    aspectRatio: 154 / 210,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: Palette.peach,
  },
  gridCover: {
    aspectRatio: 154 / 210,
    height: undefined,
    width: "100%",
  },
  cover: {
    width: "100%",
    height: "100%",
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Palette.peach,
  },
  placeholderText: {
    color: Palette.coral,
    fontSize: 48,
    fontWeight: "800",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.48)",
  },
  overlayText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  title: {
    color: Palette.ink,
    fontSize: 15,
    fontWeight: "700",
    marginTop: 10,
    minHeight: 36,
  },
  badges: {
    flexDirection: "row",
    gap: 6,
    marginTop: 8,
  },
  language: {
    backgroundColor: Palette.sage,
    borderRadius: 4,
    color: Palette.ink,
    fontSize: 10,
    fontWeight: "700",
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  free: {
    backgroundColor: "#E7F8EF",
    borderRadius: 4,
    color: "#067647",
    fontSize: 10,
    fontWeight: "800",
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  premium: {
    backgroundColor: "#FFF0E8",
    borderRadius: 4,
    color: "#B54708",
    fontSize: 10,
    fontWeight: "800",
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  duration: {
    color: Palette.muted,
    fontSize: 12,
    marginTop: 7,
  },
});
