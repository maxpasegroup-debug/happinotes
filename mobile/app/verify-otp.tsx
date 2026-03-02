import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { verifyOTP, forgotPassword } from "../services/api";

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SEC = 30;

export default function VerifyOTPScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const otpString = digits.join("");
  const canVerify = otpString.length === OTP_LENGTH && email;

  const handleDigitChange = (value: string, index: number) => {
    const char = value.replace(/[^0-9]/g, "").slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[index] = char;
      return next;
    });
    if (char && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
    if (!char && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleKeyPress = (e: { nativeEvent: { key: string } }, index: number) => {
    if (e.nativeEvent.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    if (!canVerify || !email) return;
    setLoading(true);
    try {
      await verifyOTP(email, otpString);
      router.push({
        pathname: "/reset-password",
        params: { email, otp: otpString },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Verification failed";
      Alert.alert("Error", message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email || resendCooldown > 0) return;
    try {
      await forgotPassword(email);
      setResendCooldown(RESEND_COOLDOWN_SEC);
      Alert.alert("Code resent", "A new code has been sent to your email.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to resend";
      Alert.alert("Error", message);
    }
  };

  if (!email) {
    return (
      <View style={styles.container}>
        <Text style={styles.subtitle}>Missing email. Please go back.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Enter verification code</Text>
      <Text style={styles.subtitle}>
        We sent a 6-digit code to {email}
      </Text>

      <View style={styles.otpRow}>
        {digits.map((digit, index) => (
          <TextInput
            key={index}
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            style={styles.otpBox}
            value={digit}
            onChangeText={(value) => handleDigitChange(value, index)}
            onKeyPress={(e) => handleKeyPress(e, index)}
            maxLength={1}
            keyboardType="number-pad"
            selectTextOnFocus
          />
        ))}
      </View>

      <TouchableOpacity
        style={[styles.button, (!canVerify || loading) && styles.buttonDisabled]}
        onPress={handleVerify}
        disabled={!canVerify || loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Verify</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.resendButton,
          resendCooldown > 0 && styles.resendDisabled,
        ]}
        onPress={handleResend}
        disabled={resendCooldown > 0}
      >
        <Text style={styles.resendText}>
          {resendCooldown > 0
            ? `Resend code in ${resendCooldown}s`
            : "Resend code"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 24,
    paddingTop: 60,
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#6b7280",
    marginBottom: 32,
    textAlign: "center",
  },
  otpRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 32,
  },
  otpBox: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    color: "#1f2937",
  },
  button: {
    backgroundColor: "#F59E0B",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    minWidth: 200,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  resendButton: {
    marginTop: 24,
  },
  resendDisabled: {
    opacity: 0.5,
  },
  resendText: {
    fontSize: 15,
    color: "#6b7280",
    fontWeight: "500",
  },
});
