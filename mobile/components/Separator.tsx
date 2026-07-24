import React from "react";
import { View, StyleSheet, ViewProps } from "react-native";
import { useTheme } from "../lib/theme-context";

interface SeparatorProps extends ViewProps {
  orientation?: "horizontal" | "vertical";
}

export function Separator({ orientation = "horizontal", style, ...props }: SeparatorProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        orientation === "horizontal" ? styles.horizontal : styles.vertical,
        { backgroundColor: colors.border },
        style,
      ]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  horizontal: {
    height: 1,
    width: "100%",
  },
  vertical: {
    width: 1,
    height: "100%",
  },
});
