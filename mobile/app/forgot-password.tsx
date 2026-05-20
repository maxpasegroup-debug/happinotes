import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { api } from "@/services/api";

type Step = "email" | "otp" | "reset";
type MessageResponse = {
  success: boolean;
  message: string;
};

export default function ForgotPassword() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const normalizedEmail = email.trim().toLowerCase();

  const sendOtp = async () => {
    setError("");
    setMessage("");
    if (!normalizedEmail) {
      setError("Enter your email.");
      return;
    }

    setLoading(true);
    const result = await api.post<MessageResponse>(
      "/auth/forgot-password",
      { email: normalizedEmail },
      { skipAuth: true }
    );
    setLoading(false);

    if (!result.success) {
      setError(result.error || "Could not send OTP.");
      return;
    }

    setMessage("OTP sent to your email.");
    setStep("otp");
  };

  const verifyOtp = async () => {
    setError("");
    setMessage("");
    if (otp.length !== 6) {
      setError("Enter the 6-digit OTP.");
      return;
    }

    setLoading(true);
    const result = await api.post<MessageResponse>(
      "/auth/verify-otp",
      { email: normalizedEmail, otp },
      { skipAuth: true }
    );
    setLoading(false);

    if (!result.success) {
      setError(result.error || "Invalid OTP.");
      return;
    }

    setStep("reset");
  };

  const resetPassword = async () => {
    setError("");
    setMessage("");
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    const result = await api.post<MessageResponse>(
      "/auth/reset-password",
      { email: normalizedEmail, otp, newPassword },
      { skipAuth: true }
    );
    setLoading(false);

    if (!result.success) {
      setError(result.error || "Password reset failed.");
      return;
    }

    router.replace("/");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Forgot Password</Text>

      {step === "email" && (
        <>
          <TextInput
            placeholder="Enter your email"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <TouchableOpacity style={styles.button} onPress={sendOtp} disabled={loading}>
            <Text style={styles.buttonText}>{loading ? "Sending..." : "Send OTP"}</Text>
          </TouchableOpacity>
        </>
      )}

      {step === "otp" && (
        <>
          <TextInput
            placeholder="Enter OTP"
            style={styles.input}
            value={otp}
            onChangeText={setOtp}
            keyboardType="numeric"
            maxLength={6}
          />

          <TouchableOpacity style={styles.button} onPress={verifyOtp} disabled={loading}>
            <Text style={styles.buttonText}>{loading ? "Checking..." : "Verify OTP"}</Text>
          </TouchableOpacity>
        </>
      )}

      {step === "reset" && (
        <>
          <TextInput
            placeholder="Enter new password"
            secureTextEntry
            style={styles.input}
            value={newPassword}
            onChangeText={setNewPassword}
          />

          <TouchableOpacity style={styles.button} onPress={resetPassword} disabled={loading}>
            <Text style={styles.buttonText}>{loading ? "Resetting..." : "Reset Password"}</Text>
          </TouchableOpacity>
        </>
      )}

      {message ? <Text style={styles.message}>{message}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    padding: 24,
  },
  header: {
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 30,
    textAlign: "center",
  },
  input: {
    backgroundColor: "#F2F2F2",
    padding: 16,
    borderRadius: 14,
    marginBottom: 16,
  },
  button: {
    backgroundColor: "#FF6B4A",
    padding: 18,
    borderRadius: 16,
    alignItems: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
  message: {
    color: "#067647",
    marginTop: 14,
    textAlign: "center",
  },
  error: {
    color: "#B42318",
    marginTop: 14,
    textAlign: "center",
  },
});
