import React from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { api } from "../../lib/api-client";
import { useAuth } from "../../hooks/useAuth";
import { useTheme } from "../../lib/theme-context";
import { Ionicons } from "@expo/vector-icons";
import { spacing, fontSize, borderRadius } from "../../lib/theme";

interface AdminStat {
  label: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

export default function AdminScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();

  const isAdmin = user?.role === "admin" || user?.role === "university_staff";

  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => api.get<Record<string, number>>("/admin/stats"),
    enabled: isAdmin,
  });

  if (!user) return null;

  if (!isAdmin) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Admin</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.centerContent}>
          <Ionicons name="lock-closed" size={32} color={colors.textSecondary} />
          <Text style={[styles.centerTitle, { color: colors.textPrimary }]}>Staff only</Text>
          <Text style={[styles.centerDescription, { color: colors.textSecondary }]}>
            You don't have permission to view this page.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const statItems: AdminStat[] = [
    { label: "Users", value: stats?.users ?? 0, icon: "people", color: colors.primary },
    { label: "Posts", value: stats?.posts ?? 0, icon: "document-text", color: colors.success },
    { label: "Clubs", value: stats?.clubs ?? 0, icon: "flag", color: colors.warning },
    { label: "Events", value: stats?.events ?? 0, icon: "calendar", color: colors.error },
    { label: "Listings", value: stats?.listings ?? 0, icon: "pricetag", color: colors.accent },
    { label: "Messages", value: stats?.messages ?? 0, icon: "chatbubbles", color: colors.like },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Admin Dashboard</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          {statItems.map((stat) => (
            <View
              key={stat.label}
              style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={[styles.statIcon, { backgroundColor: stat.color + "20" }]}>
                <Ionicons name={stat.icon} size={20} color={stat.color} />
              </View>
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>{stat.value}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Moderation Link */}
        <TouchableOpacity
          style={[styles.moderationCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.push("/moderation")}
        >
          <View style={[styles.moderationIcon, { backgroundColor: colors.warning + "20" }]}>
            <Ionicons name="shield-checkmark" size={24} color={colors.warning} />
          </View>
          <View style={styles.moderationInfo}>
            <Text style={[styles.moderationTitle, { color: colors.textPrimary }]}>Moderation Dashboard</Text>
            <Text style={[styles.moderationDescription, { color: colors.textSecondary }]}>
              Review reports, resolve issues, manage content
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: "600",
  },
  content: {
    padding: spacing.lg,
  },
  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  centerTitle: {
    fontSize: fontSize.lg,
    fontWeight: "600",
  },
  centerDescription: {
    fontSize: fontSize.sm,
    textAlign: "center",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statCard: {
    width: "48%",
    flexGrow: 1,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.lg,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  statValue: {
    fontSize: fontSize.xxl,
    fontWeight: "700",
    marginBottom: spacing.xs,
  },
  statLabel: {
    fontSize: fontSize.sm,
  },
  moderationCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  moderationIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  moderationInfo: {
    flex: 1,
  },
  moderationTitle: {
    fontSize: fontSize.md,
    fontWeight: "600",
    marginBottom: spacing.xs,
  },
  moderationDescription: {
    fontSize: fontSize.sm,
  },
});
