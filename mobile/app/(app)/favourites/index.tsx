import React, { useCallback, useEffect, useState } from "react";
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
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getFavourites } from "../../../services/api";
import { getToken } from "../../../services/authStorage";
import type { ApiContent } from "../../../services/api";

export default function FavouritesScreen() {
  const router = useRouter();
  const [items, setItems] = useState<ApiContent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      setItems([]);
      setLoading(false);
      return;
    }
    try {
      const res = await getFavourites(token);
      setItems(res.favourites ?? []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load favourites";
      Alert.alert("Error", msg);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = (item: ApiContent) => {
    if (item.status === "coming_soon") {
      Alert.alert("Coming Soon", "This lifebook is not live yet.");
      return;
    }
    const contentType = item.contentType ?? "";
    const id = item._id ?? item.id;
    if (!id) return;
    if (contentType === "lifebook") {
      router.push({ pathname: "/library/[id]", params: { id } });
    } else {
      router.push({ pathname: "/content/[id]", params: { id } });
    }
  };

  const typeLabel = (contentType: string) => {
    if (contentType === "lifebook") return "Lifebook";
    if (contentType === "note") return "Note";
    if (contentType === "silence") return "Silence";
    return "Content";
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {items.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No favourites yet.</Text>
          </View>
        ) : (
          items.map((item) => (
            <Pressable
              key={item._id}
              style={[styles.card, item.status === "coming_soon" && styles.cardDisabled]}
              onPress={() => openDetail(item)}
              android_ripple={{ color: "rgba(0,0,0,0.05)" }}
            >
              <Image
                source={{ uri: item.thumbnailUrl }}
                style={styles.thumb}
                contentFit="cover"
              />
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.typeLabel}>
                  {typeLabel(item.contentType)}
                </Text>
                {item.status === "coming_soon" ? (
                  <Text style={styles.comingSoonText}>Coming Soon</Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  emptyWrap: {
    paddingVertical: 48,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 17,
    color: "#6B7280",
    textAlign: "center",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardDisabled: {
    opacity: 0.82,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: "#E5E7EB",
  },
  cardBody: {
    flex: 1,
    marginLeft: 14,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
  },
  typeLabel: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  comingSoonText: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "700",
    color: "#374151",
  },
});
