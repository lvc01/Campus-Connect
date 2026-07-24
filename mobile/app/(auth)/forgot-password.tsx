import React, { useState } from "react";
import { View, Text, StyleSheet, SafeAreaView, Alert } from "react-native";
import { Link, router } from "expo-router";
import { useTheme } from "../../lib/theme-context";
import { api } from "../../lib/api-client";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { spacing, fontSize } from "../../lib/theme";

export default function ForgotPasswordScreen() {
  const { colors } = useTheme();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email) {
      Alert.alert("Error", "Please enter your email");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      router.push({
        pathname: "/(auth)/reset-password",
        params: { email },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Something went wrong";
      Alert.alert("Error", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.primary }]}>🔑</Text>
          <Text style={[styles.heading, { color: colors.textPrimary }]}>Reset your password</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Enter your email and we'll send you a reset code
          </Text>
        </View>

        <View style={styles.form}>
          <Input
            label="University email"
            placeholder="student@cuchd.in"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />

          <Button
            title="Send reset code"
            onPress={handleSubmit}
            loading={loading}
            fullWidth
          />
        </View>

        <View style={styles.links}>
          <Text style={[styles.linkText, { color: colors.textSecondary }]}>
            Remember your password?{" "}
          </Text>
          <Link href="/(auth)/login" asChild>
            <Text style={[styles.link, { color: colors.primary }]}>Log in</Text>
          </Link>
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
    marginTop: spacing.xxl * 2,
  },
  linkText: {
    fontSize: fontSize.sm,
  },
  link: {
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
});
