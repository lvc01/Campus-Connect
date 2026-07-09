import React from "react";
import { View, Text, StyleSheet, ViewProps } from "react-native";
import { useTheme } from "../lib/theme-context";
import { borderRadius, spacing, fontSize } from "../lib/theme";

interface CardProps extends ViewProps {
  children: React.ReactNode;
}

export function Card({ children, style, ...props }: CardProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, style]} {...props}>
      {children}
    </View>
  );
}

export function CardHeader({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[styles.header, style]}>{children}</View>;
}

export function CardTitle({ children, style }: { children: React.ReactNode; style?: object }) {
  const { colors } = useTheme();
  return <Text style={[styles.title, { color: colors.textPrimary }, style]}>{children}</Text>;
}

export function CardDescription({ children, style }: { children: React.ReactNode; style?: object }) {
  const { colors } = useTheme();
  return <Text style={[styles.description, { color: colors.textSecondary }, style]}>{children}</Text>;
}

export function CardContent({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[styles.content, style]}>{children}</View>;
}

export function CardFooter({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[styles.footer, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  header: {
    padding: spacing.lg,
    paddingBottom: 0,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: "600",
  },
  description: {
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  content: {
    padding: spacing.lg,
  },
  footer: {
    padding: spacing.lg,
    paddingTop: 0,
    flexDirection: "row",
    alignItems: "center",
  },
});
