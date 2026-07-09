import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, SafeAreaView, Alert } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useAuth } from "../../hooks/useAuth";
import { useTheme } from "../../lib/theme-context";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { spacing, fontSize } from "../../lib/theme";

export default function VerifyOtpScreen() {
  const { email, devOtp } = useLocalSearchParams<{ email: string; devOtp?: string }>();
  const { verifyOtp } = useAuth();
  const { colors } = useTheme();
  const [code, setCode] = useState(devOtp || "");
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleVerify = async () => {
    if (!code || code.length !== 6) {
      Alert.alert("Error", "Please enter a 6-digit code");
      return;
    }
    setLoading(true);
    try {
      await verifyOtp(email!, code);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Verification failed";
      Alert.alert("Error", message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setCountdown(60);
    Alert.alert("OTP Resent", "A new verification code has been sent to your email");
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.primary }]}>Verify Email</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Enter the 6-digit code sent to{"\n"}{email}
          </Text>
        </View>

        {devOtp && (
          <View style={[styles.devOtpBox, { backgroundColor: colors.muted }]}>
            <Text style={[styles.devOtpLabel, { color: colors.textSecondary }]}>Dev Mode — Auto-filled OTP:</Text>
            <Text style={[styles.devOtpCode, { color: colors.primary }]}>{devOtp}</Text>
          </View>
        )}

        <View style={styles.form}>
          <Input
            label="Verification Code"
            placeholder="000000"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
            textAlign="center"
          />

          <Button
            title="Verify"
            onPress={handleVerify}
            loading={loading}
            fullWidth
          />

          <Button
            title={countdown > 0 ? `Resend OTP (${countdown}s)` : "Resend OTP"}
            variant="ghost"
            onPress={handleResend}
            disabled={countdown > 0}
            fullWidth
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  header: {
    alignItems: "center",
    marginBottom: spacing.xxl * 2,
  },
  title: {
    fontSize: fontSize.display,
    fontWeight: "700",
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.md,
    textAlign: "center",
  },
  devOtpBox: {
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.lg,
    alignItems: "center",
  },
  devOtpLabel: {
    fontSize: fontSize.sm,
    marginBottom: spacing.xs,
  },
  devOtpCode: {
    fontSize: fontSize.xl,
    fontWeight: "700",
    letterSpacing: 4,
  },
  form: {
    gap: spacing.md,
  },
});
