import React, { useCallback, useEffect, useState } from "react";
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
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  addToFavourites,
  getBooks,
  getFavourites,
  removeFromFavourites,
} from "../../../services/api";
import { getToken } from "../../../services/authStorage";
import type { ApiContent } from "../../../services/api";

export default function Library() {
  const router = useRouter();
  const [contents, setContents] = useState<ApiContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [favouriteIds, setFavouriteIds] = useState<Set<string>>(new Set());
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const loadFavourites = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    try {
      const res = await getFavourites(token);
      const ids = new Set((res.favourites ?? []).map((f) => f._id));
      setFavouriteIds(ids);
    } catch (_) {}
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const token = await getToken();
        const response = await getBooks(token ?? undefined);
        if (!cancelled) {
          setContents(response.contents ?? []);
        }
        if (token && !cancelled) await loadFavourites();
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Failed to load lifebooks";
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
  }, [loadFavourites]);

  const toggleFavourite = useCallback(
    async (contentId: string) => {
      const token = await getToken();
      if (!token) {
        Alert.alert("Sign in required", "Please sign in to add favourites.");
        return;
      }
      setTogglingId(contentId);
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
        setTogglingId(null);
      }
    },
    [favouriteIds]
  );

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
        <Text style={styles.header}>Lifebooks</Text>

        <FlatList
          data={contents}
          keyExtractor={(item) => item._id}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.listContent}
          listEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>Lifebooks launching soon.</Text>
              <Text style={styles.emptySub}>
                Powerful English audio journeys are coming.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isFav = favouriteIds.has(item._id);
            const isComingSoon = item.status === "coming_soon";
            return (
              <Pressable
                style={[styles.card, isComingSoon && styles.cardDisabled]}
                onPress={() => {
                  if (isComingSoon) {
                    Alert.alert("Coming Soon", "This lifebook is not live yet.");
                    return;
                  }
                  router.push({ pathname: "/library/[id]", params: { id: item._id } });
                }}
              >
                <View style={styles.thumbWrap}>
                  <Image
                    source={{ uri: item.thumbnailUrl }}
                    style={styles.thumbnail}
                    contentFit="cover"
                  />
                  {isComingSoon ? (
                    <View style={styles.comingSoonBadge}>
                      <Text style={styles.comingSoonBadgeText}>Coming Soon</Text>
                    </View>
                  ) : null}
                  <Pressable
                    style={styles.heartIcon}
                    onPress={(e) => {
                      e?.stopPropagation?.();
                      toggleFavourite(item._id);
                    }}
                    disabled={togglingId === item._id}
                  >
                    <Ionicons
                      name={isFav ? "heart" : "heart-outline"}
                      size={20}
                      color={isFav ? "#FF6B4A" : "#6B7280"}
                    />
                  </Pressable>
                </View>
                <Text style={styles.title} numberOfLines={2}>
                  {item.title}
                </Text>
              </Pressable>
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
    backgroundColor: "#FFFFFF",
  },
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 20,
    color: "#1F2937",
  },
  listContent: {
    paddingBottom: 24,
    flexGrow: 1,
  },
  columnWrapper: {
    marginBottom: 16,
    justifyContent: "space-between",
  },
  card: {
    flex: 1,
    maxWidth: "48%",
    marginHorizontal: 2,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#F9FAFB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  cardDisabled: {
    opacity: 0.82,
  },
  thumbWrap: {
    width: "100%",
    position: "relative",
  },
  thumbnail: {
    width: "100%",
    aspectRatio: 3 / 4,
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
  comingSoonBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "rgba(17,24,39,0.85)",
  },
  comingSoonBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    marginTop: 8,
    paddingHorizontal: 10,
    paddingBottom: 12,
    color: "#1F2937",
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
    color: "#1F2937",
    marginBottom: 8,
    textAlign: "center",
  },
  emptySub: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },
});
