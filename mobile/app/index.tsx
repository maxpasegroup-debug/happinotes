import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import Toast from "react-native-toast-message";
import { api } from "@/services/api";
import { AuthUser, saveAuth } from "@/store/authStore";
import { registerPushNotifications } from "@/services/notifications";

type AuthResponse = { success: boolean; token: string; user: AuthUser };

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const login = async () => {
    setError("");
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setError("Enter your email and password.");
      return;
    }

    setLoading(true);
    const result = await api.post<AuthResponse>(
      "/auth/login",
      { email: normalizedEmail, password },
      { skipAuth: true }
    );
    setLoading(false);

    if (!result.success || !result.data) {
      setError(result.error || "Could not sign in.");
      return;
    }

    await saveAuth(result.data.token, result.data.user);
    router.replace(result.data.user.role === "admin" ? "/(admin)/dashboard" : "/(app)/home");
    Toast.show({ type: "success", text1: "Welcome back" });
    void registerPushNotifications();
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "right", "bottom", "left"]}>
      <StatusBar style="dark" backgroundColor="#FFFFFF" />
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.logoBox}>
            <Image source={require("../assets/images/happinotes-logo.png")} style={styles.logo} resizeMode="contain" />
          </View>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to continue listening.</Text>
          <TextInput
            accessibilityLabel="Email address"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="Email address"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
          />
          <View style={styles.passwordBox}>
            <TextInput
              accessibilityLabel="Password"
              autoCapitalize="none"
              autoComplete="current-password"
              placeholder="Password"
              secureTextEntry={!showPassword}
              style={styles.passwordInput}
              value={password}
              onChangeText={setPassword}
            />
            <Pressable onPress={() => setShowPassword((value) => !value)} accessibilityRole="button">
              <Text style={styles.toggle}>{showPassword ? "Hide" : "Show"}</Text>
            </Pressable>
          </View>
          <Pressable onPress={() => router.push("/forgot-password")}>
            <Text style={styles.forgot}>Forgot password?</Text>
          </Pressable>
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <TouchableOpacity style={styles.button} onPress={login} disabled={loading}>
            <Text style={styles.buttonText}>{loading ? "Signing in..." : "Sign In"}</Text>
          </TouchableOpacity>
          <Pressable onPress={() => router.push("/signup")}>
            <Text style={styles.link}>New to HappiNotes? Create an account</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFFFFF" },
  keyboard: { flex: 1 },
  container: { flexGrow: 1, justifyContent: "center", padding: 24, paddingBottom: 32 },
  logoBox: { alignItems: "center", marginBottom: 20 },
  logo: { width: 150, height: 130 },
  title: { color: "#242424", fontSize: 28, fontWeight: "800", textAlign: "center" },
  subtitle: { color: "#667085", fontSize: 15, marginBottom: 24, marginTop: 8, textAlign: "center" },
  input: { backgroundColor: "#F2F2F2", borderRadius: 14, color: "#242424", marginBottom: 14, padding: 16 },
  passwordBox: { alignItems: "center", backgroundColor: "#F2F2F2", borderRadius: 14, flexDirection: "row", marginBottom: 8 },
  passwordInput: { color: "#242424", flex: 1, padding: 16 },
  toggle: { color: "#FF6B4A", fontWeight: "700", paddingHorizontal: 16, paddingVertical: 12 },
  forgot: { color: "#555555", fontWeight: "600", marginTop: 8, textAlign: "right" },
  button: { alignItems: "center", backgroundColor: "#FF6B4A", borderRadius: 16, marginTop: 18, padding: 18 },
  buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  error: { color: "#B42318", marginTop: 14, textAlign: "center" },
  link: { color: "#555555", fontWeight: "600", marginTop: 20, textAlign: "center" },
});
