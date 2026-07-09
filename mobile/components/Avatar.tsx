import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { fontSize } from "../lib/theme";

interface AvatarProps {
  uri?: string | null;
  name?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
}

function getInitials(name?: string | null): string {
  if (!name) return "U";
  return name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getColorForName(name?: string | null): string {
  const safeName = name || "U";
  const hash = safeName.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const hues = [210, 160, 30, 340, 270, 190, 50, 120];
  const hue = hues[hash % hues.length];
  return `hsl(${hue}, 60%, 50%)`;
}

const sizeMap = {
  sm: 32,
  md: 40,
  lg: 56,
  xl: 80,
};

const textSizeMap = {
  sm: fontSize.xs,
  md: fontSize.sm,
  lg: fontSize.md,
  xl: fontSize.xl,
};

export function Avatar({ uri, name, size = "md" }: AvatarProps) {
  const dimension = sizeMap[size];
  const textSize = textSizeMap[size];

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[
          styles.image,
          { width: dimension, height: dimension, borderRadius: dimension / 2 },
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.placeholder,
        {
          width: dimension,
          height: dimension,
          borderRadius: dimension / 2,
          backgroundColor: getColorForName(name),
        },
      ]}
    >
      <Text style={[styles.initials, { fontSize: textSize }]}>{getInitials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: "#f1f5f9",
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    color: "#ffffff",
    fontWeight: "600",
  },
});
