import React, { useState } from "react";
import { View, Text, StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform, Alert, Image } from "react-native";
import { Link } from "expo-router";
import { useAuth } from "../../hooks/useAuth";
import { useTheme } from "../../lib/theme-context";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { spacing, fontSize } from "../../lib/theme";

export default function LoginScreen() {
  const { login } = useAuth();
  const { colors, resolvedTheme } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Login failed";
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
          <Image 
            source={resolvedTheme === 'dark' ? require('../../assets/logo-white.png') : require('../../assets/logo-red.png')} 
            style={{ width: 80, height: 80, marginBottom: spacing.md }} 
            resizeMode="contain" 
          />
          <Text style={[styles.title, { color: colors.primary }]}>Campus Connect</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Sign in to your account</Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Email"
            placeholder="student@cuchd.in"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <Input
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Button
            title="Sign In"
            onPress={handleLogin}
            loading={loading}
            fullWidth
          />

          <Link href="/(auth)/register" asChild>
            <Button title="Create Account" variant="ghost" fullWidth />
          </Link>

          <Link href="/(auth)/forgot-password" asChild>
            <Button title="Forgot Password?" variant="ghost" fullWidth />
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
