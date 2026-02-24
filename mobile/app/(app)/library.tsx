import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function Library() {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Audio Library</Text>

      <View style={styles.card}>
        <Text style={styles.title}>Sample Audio Book</Text>
        <Text style={styles.subtitle}>
          Your audio books will appear here
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    padding: 20,
  },
  header: {
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 20,
  },
  card: {
    backgroundColor: "#F4F4F4",
    padding: 20,
    borderRadius: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
  },
  subtitle: {
    color: "#666",
    marginTop: 5,
  },
});