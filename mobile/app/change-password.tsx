import React, { useState } from "react";
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Alert } from "react-native";
import { router } from "expo-router";
import { useTheme } from "../lib/theme-context";
import { api } from "../lib/api-client";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Ionicons } from "@expo/vector-icons";
import { spacing, fontSize } from "../lib/theme";

export default function ChangePasswordScreen() {
  const { colors } = useTheme();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleChange = async () => {
    if (!currentPassword) {
      Alert.alert("Error", "Please enter your current password");
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
      await api.post("/users/me/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setSuccess(true);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to change password";
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
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Change Password</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.content}>
          <View style={styles.successBox}>
            <Ionicons name="checkmark-circle" size={48} color={colors.success} />
            <Text style={[styles.successTitle, { color: colors.textPrimary }]}>Password changed</Text>
            <Text style={[styles.successText, { color: colors.textSecondary }]}>
              Your password has been updated successfully.
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
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Change Password</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.form}>
          <Text style={[styles.stepText, { color: colors.textSecondary }]}>
            Enter your current password and choose a new one.
          </Text>
          <Input
            label="Current password"
            placeholder="••••••••"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
          />
          <Input
            label="New password"
            placeholder="••••••••"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            helperText="Minimum 8 characters."
          />
          <Input
            label="Confirm new password"
            placeholder="••••••••"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />
          <Button
            title="Update password"
            onPress={handleChange}
            loading={loading}
            fullWidth
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
  stepText: {
    fontSize: fontSize.sm,
    marginBottom: spacing.md,
  },
  form: {
    gap: spacing.md,
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
