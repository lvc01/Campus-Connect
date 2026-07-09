import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../lib/theme-context";
import { spacing, fontSize, borderRadius } from "../lib/theme";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "secondary" | "destructive" | "outline";
}

export function Badge({ children, variant = "default" }: BadgeProps) {
  const { colors } = useTheme();

  const getBackgroundColor = () => {
    switch (variant) {
      case "default": return colors.primary;
      case "secondary": return colors.secondary;
      case "destructive": return colors.destructive;
      case "outline": return "transparent";
    }
  };

  const getTextColor = () => {
    switch (variant) {
      case "default": return colors.primaryForeground;
      case "secondary": return colors.textSecondary;
      case "destructive": return colors.destructiveForeground;
      case "outline": return colors.textPrimary;
    }
  };

  const getBorderColor = () => {
    switch (variant) {
      case "outline": return colors.border;
      default: return "transparent";
    }
  };

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: getBackgroundColor(),
          borderColor: getBorderColor(),
        },
      ]}
    >
      <Text style={[styles.text, { color: getTextColor() }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  text: {
    fontSize: fontSize.xs,
    fontWeight: "500",
  },
});
