import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

const slides = [
  {
    title: "Welcome to HappiNotes",
    body: "Exclusive, high quality audiobooks in English, Malayalam, and Hindi.",
  },
  {
    title: "Choose Your Language",
    body: "Start in your preferred language and change it anytime from profile.",
  },
  {
    title: "Free and Premium",
    body: "Preview free chapters and unlock the full catalog with Premium.",
  },
];

export default function Onboarding() {
  const router = useRouter();
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);

  async function finish() {
    await AsyncStorage.setItem("seen_onboarding", "true");
    router.replace("/");
  }

  const slide = slides[index];

  return (
    <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.art}>
        <Text style={styles.note}>H</Text>
      </View>
      <Text style={styles.title}>{slide.title}</Text>
      <Text style={styles.body}>{slide.body}</Text>
      <View style={styles.dots}>
        {slides.map((_, dotIndex) => (
          <View key={dotIndex} style={[styles.dot, index === dotIndex && styles.dotActive]} />
        ))}
      </View>
      <View style={styles.actions}>
        <Pressable onPress={finish}><Text style={styles.skip}>{t("skip")}</Text></Pressable>
        <Pressable
          style={styles.button}
          onPress={() => (index === slides.length - 1 ? finish() : setIndex(index + 1))}
        >
          <Text style={styles.buttonText}>{index === slides.length - 1 ? t("getStarted") : "Next"}</Text>
        </Pressable>
      </View>
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFFFFF" },
  container: { flexGrow: 1, backgroundColor: "#FFFFFF", justifyContent: "center", padding: 24, paddingBottom: 32 },
  art: { alignItems: "center", alignSelf: "center", backgroundColor: "#FFF0E8", borderRadius: 8, height: 180, justifyContent: "center", marginBottom: 34, width: 180 },
  note: { color: "#FF6B4A", fontSize: 82, fontWeight: "900" },
  title: { color: "#181818", fontSize: 30, fontWeight: "900", textAlign: "center" },
  body: { color: "#667085", fontSize: 16, lineHeight: 24, marginTop: 12, textAlign: "center" },
  dots: { flexDirection: "row", gap: 8, justifyContent: "center", marginVertical: 30 },
  dot: { backgroundColor: "#D0D5DD", borderRadius: 4, height: 8, width: 8 },
  dotActive: { backgroundColor: "#FF6B4A", width: 24 },
  actions: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  skip: { color: "#667085", fontWeight: "800" },
  button: { backgroundColor: "#FF6B4A", borderRadius: 8, paddingHorizontal: 18, paddingVertical: 13 },
  buttonText: { color: "#FFFFFF", fontWeight: "900" },
});
