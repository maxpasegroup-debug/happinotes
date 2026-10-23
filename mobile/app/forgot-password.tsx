import { useRouter } from "expo-router";
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/services/api";
import { OtpInput } from "@/components/OtpInput";
import Toast from "react-native-toast-message";

type ApiResponse = { success: boolean; message: string };

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const normalizedEmail = email.trim().toLowerCase();

  const requestCode = async () => {
    setError("");
    if (!normalizedEmail) return setError("Enter your email address.");
    setLoading(true);
    const result = await api.post<ApiResponse>("/auth/forgot-password", { email: normalizedEmail }, { skipAuth: true });
    setLoading(false);
    if (!result.success) return setError(result.error || "Could not request a reset code.");
    setSent(true);
  };

  const resetPassword = async () => {
    setError("");
    if (!/^\d{6}$/.test(otp)) return setError("Enter the 6-digit code from your email.");
    if (newPassword.length < 8) return setError("Use a password with at least 8 characters.");
    if (newPassword !== confirmPassword) return setError("Your passwords do not match.");

    setLoading(true);
    const result = await api.post<ApiResponse>(
      "/auth/reset-password",
      { email: normalizedEmail, otp, newPassword },
      { skipAuth: true }
    );
    setLoading(false);
    if (!result.success) return setError(result.error || "Could not reset your password.");
    Toast.show({ type: "success", text1: "Password reset", text2: "Sign in with your new password." });
    router.replace("/");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.header}>Reset password</Text>
          <Text style={styles.info}>
            {sent
              ? `If an account exists for ${normalizedEmail}, a reset code will arrive shortly.`
              : "Enter your account email and we will send a short-lived reset code."}
          </Text>
          {!sent ? (
            <>
              <TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder="Email address" style={styles.input} value={email} onChangeText={setEmail} />
              <TouchableOpacity style={styles.button} onPress={requestCode} disabled={loading}>
                <Text style={styles.buttonText}>{loading ? "Sending..." : "Send Reset Code"}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <OtpInput value={otp} onChange={setOtp} hasError={Boolean(error)} />
              <TextInput autoCapitalize="none" autoComplete="new-password" placeholder="New password (at least 8 characters)" secureTextEntry style={styles.input} value={newPassword} onChangeText={setNewPassword} />
              <TextInput autoCapitalize="none" autoComplete="new-password" placeholder="Confirm new password" secureTextEntry style={styles.input} value={confirmPassword} onChangeText={setConfirmPassword} />
              <TouchableOpacity style={styles.button} onPress={resetPassword} disabled={loading}>
                <Text style={styles.buttonText}>{loading ? "Resetting..." : "Reset Password"}</Text>
              </TouchableOpacity>
              <Pressable onPress={() => { setSent(false); setOtp(""); setError(""); }}>
                <Text style={styles.link}>Use a different email</Text>
              </Pressable>
            </>
          )}
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <Pressable onPress={() => router.replace("/")}>
            <Text style={styles.link}>Back to sign in</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFFFFF" },
  container: { flexGrow: 1, backgroundColor: "#FFFFFF", justifyContent: "center", padding: 24, paddingBottom: 32 },
  header: { color: "#242424", fontSize: 28, fontWeight: "800", marginBottom: 12, textAlign: "center" },
  info: { color: "#667085", lineHeight: 21, marginBottom: 22, textAlign: "center" },
  input: { backgroundColor: "#F2F2F2", borderRadius: 14, color: "#242424", marginBottom: 14, padding: 16 },
  button: { alignItems: "center", backgroundColor: "#FF6B4A", borderRadius: 16, marginTop: 8, padding: 18 },
  buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  link: { color: "#555555", fontWeight: "600", marginTop: 18, textAlign: "center" },
  error: { color: "#B42318", marginTop: 14, textAlign: "center" },
});
