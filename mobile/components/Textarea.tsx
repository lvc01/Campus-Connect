import React from "react";
import { TextInput, StyleSheet, TextInputProps } from "react-native";
import { useTheme } from "../lib/theme-context";
import { borderRadius, fontSize, spacing } from "../lib/theme";

interface TextareaProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, style, ...props }: TextareaProps) {
  const { colors } = useTheme();

  return (
    <TextInput
      style={[
        styles.textarea,
        {
          borderColor: error ? colors.destructive : colors.border,
          color: colors.textPrimary,
          backgroundColor: colors.background,
        },
        style,
      ]}
      placeholderTextColor={colors.mutedForeground}
      multiline
      textAlignVertical="top"
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  textarea: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
    minHeight: 100,
  },
});
