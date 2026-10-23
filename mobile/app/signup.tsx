import { useRouter } from "expo-router";
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { api } from "@/services/api";
import { AuthUser, saveAuth } from "@/store/authStore";
import { registerPushNotifications } from "@/services/notifications";

type AuthResponse = { success: boolean; token: string; user: AuthUser };

export default function Signup() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const signup = async () => {
    setError("");
    const normalizedEmail = email.trim().toLowerCase();
    if (!name.trim() || !normalizedEmail) return setError("Enter your name and email address.");
    if (password.length < 8) return setError("Use a password with at least 8 characters.");
    if (password !== confirmPassword) return setError("Your passwords do not match.");

    setLoading(true);
    const result = await api.post<AuthResponse>(
      "/auth/signup",
      { name: name.trim(), email: normalizedEmail, password },
      { skipAuth: true }
    );
    setLoading(false);

    if (!result.success || !result.data) {
      setError(result.error || "Could not create your account.");
      return;
    }

    await saveAuth(result.data.token, result.data.user);
    Toast.show({ type: "success", text1: "Account created" });
    void registerPushNotifications();
    router.replace(result.data.user.role === "admin" ? "/(admin)/dashboard" : "/(app)/home");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.header}>Create account</Text>
          <Text style={styles.subtitle}>Save your place and keep listening anywhere.</Text>
          <TextInput autoCapitalize="words" autoComplete="name" placeholder="Full name" style={styles.input} value={name} onChangeText={setName} />
          <TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder="Email address" style={styles.input} value={email} onChangeText={setEmail} />
          <TextInput autoCapitalize="none" autoComplete="new-password" placeholder="Password (at least 8 characters)" secureTextEntry style={styles.input} value={password} onChangeText={setPassword} />
          <TextInput autoCapitalize="none" autoComplete="new-password" placeholder="Confirm password" secureTextEntry style={styles.input} value={confirmPassword} onChangeText={setConfirmPassword} />
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <TouchableOpacity style={styles.button} onPress={signup} disabled={loading}>
            <Text style={styles.buttonText}>{loading ? "Creating account..." : "Create Account"}</Text>
          </TouchableOpacity>
          <Pressable onPress={() => router.replace("/")}>
            <Text style={styles.link}>Already have an account? Sign in</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFFFFF" },
  container: { flexGrow: 1, backgroundColor: "#FFFFFF", justifyContent: "center", padding: 24, paddingBottom: 32 },
  header: { color: "#242424", fontSize: 28, fontWeight: "800", textAlign: "center" },
  subtitle: { color: "#667085", marginBottom: 26, marginTop: 9, textAlign: "center" },
  input: { backgroundColor: "#F2F2F2", borderRadius: 14, color: "#242424", marginBottom: 14, padding: 16 },
  button: { alignItems: "center", backgroundColor: "#FF6B4A", borderRadius: 16, marginTop: 8, padding: 18 },
  buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  link: { color: "#555555", fontWeight: "600", marginTop: 20, textAlign: "center" },
  error: { color: "#B42318", marginTop: 8, textAlign: "center" },
});
