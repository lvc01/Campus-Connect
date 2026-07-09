import React, { useState } from "react";
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Alert } from "react-native";
import { router } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "../lib/theme-context";
import { useAuth } from "../hooks/useAuth";
import { api } from "../lib/api-client";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Ionicons } from "@expo/vector-icons";
import { spacing, fontSize } from "../lib/theme";

export default function UsernameScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState(user?.username || "");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const isValid = /^[a-zA-Z0-9._]{3,30}$/.test(username);
  const isChanged = username !== user?.username;

  const handleSave = async () => {
    if (!isValid) {
      Alert.alert("Invalid username", "Use 3-30 characters: letters, numbers, dots, underscores.");
      return;
    }
    if (!isChanged) {
      setSuccess(true);
      return;
    }
    setLoading(true);
    try {
      await api.patch("/users/me/username", { username });
      await queryClient.invalidateQueries({ queryKey: ["auth"] });
      setSuccess(true);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update username";
      Alert.alert("Error", message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Username</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.content}>
          <View style={styles.successBox}>
            <Ionicons name="checkmark-circle" size={48} color={colors.success} />
            <Text style={[styles.successTitle, { color: colors.textPrimary }]}>Username updated</Text>
            <Text style={[styles.successText, { color: colors.textSecondary }]}>
              Your username is now @{username}
            </Text>
          </View>
          <Button title="Done" onPress={() => router.back()} fullWidth />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Username</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.form}>
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            Your username is how people find and mention you on Campus Connect.
          </Text>
          <Input
            label="Username"
            placeholder="your.username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {username.length > 0 && !isValid && (
            <Text style={[styles.error, { color: colors.destructive }]}>
              3-30 characters. Letters, numbers, dots, underscores only.
            </Text>
          )}
          {isValid && isChanged && (
            <Text style={[styles.preview, { color: colors.textSecondary }]}>
              Preview: <Text style={{ color: colors.primary, fontWeight: "600" }}>@{username}</Text>
            </Text>
          )}
          <Button
            title="Save username"
            onPress={handleSave}
            loading={loading}
            fullWidth
            disabled={!isValid && username.length > 0}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 17, fontWeight: "600" },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  description: {
    fontSize: fontSize.sm,
    marginBottom: spacing.md,
  },
  form: {
    gap: spacing.md,
  },
  error: {
    fontSize: fontSize.xs,
    marginTop: -spacing.xs,
  },
  preview: {
    fontSize: fontSize.sm,
    marginTop: -spacing.xs,
  },
  successBox: {
    alignItems: "center",
    paddingVertical: spacing.xxl * 2,
    gap: spacing.sm,
  },
  successTitle: {
    fontSize: fontSize.xl,
    fontWeight: "700",
  },
  successText: {
    fontSize: fontSize.sm,
    textAlign: "center",
  },
});
