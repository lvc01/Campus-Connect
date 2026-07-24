import React from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../lib/theme-context";
import { api } from "../lib/api-client";
import { spacing, fontSize, borderRadius } from "../lib/theme";
import type { Ad } from "../types";

interface AdCardProps {
  ad: Ad;
}

export function AdCard({ ad }: AdCardProps) {
  const { colors } = useTheme();

  const handlePress = async () => {
    try {
      await api.post(`/ads/${ad.id}/click`);
    } catch {}
    if (ad.target_url) {
      Linking.openURL(ad.target_url);
    }
  };

  const handleImpression = async () => {
    try {
      await api.post(`/ads/${ad.id}/impression`);
    } catch {}
  };

  React.useEffect(() => {
    handleImpression();
  }, []);

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <View style={styles.adBadge}>
        <Text style={[styles.adBadgeText, { color: colors.textTertiary }]}>Ad</Text>
      </View>

      {ad.image_url && (
        <Image source={{ uri: ad.image_url }} style={styles.image} resizeMode="cover" />
      )}

      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
          {ad.title}
        </Text>
        {ad.content && (
          <Text style={[styles.body, { color: colors.textSecondary }]} numberOfLines={2}>
            {ad.content}
          </Text>
        )}
      </View>

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <Ionicons name="open-outline" size={12} color={colors.textTertiary} />
        <Text style={[styles.linkText, { color: colors.textTertiary }]}>Learn more</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  adBadge: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 1,
  },
  adBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#fff",
  },
  image: {
    width: "100%",
    height: 160,
  },
  content: {
    padding: spacing.md,
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: "600",
    marginBottom: spacing.xs,
  },
  body: {
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
  },
  linkText: {
    fontSize: fontSize.xs,
  },
});
