import React, { useState } from "react";
import { View, Text, StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { Link, router } from "expo-router";
import { useAuth } from "../../hooks/useAuth";
import { useTheme } from "../../lib/theme-context";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { spacing, fontSize } from "../../lib/theme";

export default function RegisterScreen() {
  const { register } = useAuth();
  const { colors } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!email || !password || !displayName) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    if (!email.endsWith("@cuchd.in")) {
      Alert.alert("Error", "Only @cuchd.in email addresses are allowed");
      return;
    }
    if (password.length < 8) {
      Alert.alert("Error", "Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      const result = await register(email, password, displayName);
      router.push({
        pathname: "/(auth)/verify-otp",
        params: { email, devOtp: result.dev_otp },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Registration failed";
      Alert.alert("Error", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.content}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.primary }]}>Create Account</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Join your campus community</Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Display Name"
            placeholder="Your name"
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
          />
          <Input
            label="Email"
            placeholder="student@cuchd.in"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            helperText="Must use a Chandigarh University email"
          />
          <Input
            label="Password"
            placeholder="Min 8 characters"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            helperText="Minimum 8 characters with at least one uppercase, lowercase and digit"
          />

          <Button
            title="Create Account"
            onPress={handleRegister}
            loading={loading}
            fullWidth
          />

          <Link href="/(auth)/login" asChild>
            <Button title="Already have an account? Sign In" variant="ghost" fullWidth />
          </Link>
        </View>
      </KeyboardAvoidingView>
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
  },
  form: {
    gap: spacing.md,
  },
});
