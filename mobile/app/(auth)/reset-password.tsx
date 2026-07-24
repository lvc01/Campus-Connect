import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, SafeAreaView, Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useTheme } from "../../lib/theme-context";
import { api } from "../../lib/api-client";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { spacing, fontSize } from "../../lib/theme";

export default function ResetPasswordScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const { colors } = useTheme();
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!email) router.push("/(auth)/forgot-password");
  }, [email]);

  const handleSubmit = async () => {
    if (!code || code.length !== 6) {
      Alert.alert("Error", "Please enter a 6-digit code");
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert("Error", "Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", {
        email,
        code,
        new_password: newPassword,
      });
      setSuccess(true);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Reset failed";
      Alert.alert("Error", message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.primary }]}>✅</Text>
            <Text style={[styles.heading, { color: colors.textPrimary }]}>Password reset successful</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              You can now log in with your new password.
            </Text>
          </View>
          <Button
            title="Log in"
            onPress={() => router.replace("/(auth)/login")}
            fullWidth
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.primary }]}>🔑</Text>
          <Text style={[styles.heading, { color: colors.textPrimary }]}>Set new password</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Enter the reset code sent to{"\n"}{email}
          </Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Reset code"
            placeholder="000000"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
            helperText="Enter the 6-digit code sent to your email."
          />

          <Input
            label="New password"
            placeholder="••••••••"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            helperText="Minimum 8 characters with at least one uppercase, lowercase and digit."
          />

          <Input
            label="Confirm password"
            placeholder="••••••••"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />

          <Button
            title="Reset password"
            onPress={handleSubmit}
            loading={loading}
            fullWidth
          />
        </View>

        <View style={styles.links}>
          <Button
            title="Resend code"
            variant="ghost"
            onPress={() => router.push("/(auth)/forgot-password")}
          />
          <Button
            title="Back to login"
            variant="ghost"
            onPress={() => router.replace("/(auth)/login")}
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
    fontSize: 48,
    marginBottom: spacing.md,
  },
  heading: {
    fontSize: fontSize.xxl,
    fontWeight: "700",
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: fontSize.sm,
    textAlign: "center",
  },
  form: {
    gap: spacing.md,
  },
  links: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.sm,
    marginTop: spacing.xxl * 2,
  },
});
