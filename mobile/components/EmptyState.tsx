import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../lib/theme-context";
import { spacing, fontSize } from "../lib/theme";

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
}

export function EmptyState({ icon = "file-tray-outline", title, description }: EmptyStateProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <Text style={[styles.icon, { color: colors.textSecondary }]}>{icon === "file-tray-outline" ? "📭" : undefined}</Text>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
      {description && (
        <Text style={[styles.description, { color: colors.textSecondary }]}>{description}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxl * 3,
    paddingHorizontal: spacing.xl,
  },
  icon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  description: {
    fontSize: fontSize.sm,
    textAlign: "center",
    lineHeight: 20,
  },
});
