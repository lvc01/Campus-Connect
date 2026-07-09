import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
  Pressable,
  TouchableOpacity,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { api } from "../../lib/api-client";
import { useTheme } from "../../lib/theme-context";
import { Avatar } from "../../components/Avatar";
import { spacing, fontSize, borderRadius } from "../../lib/theme";
import { getWSClient, releaseWSClient, type WSClient } from "../../lib/websocket";
import { Ionicons } from "@expo/vector-icons";
import type { Notification } from "../../types";

function getRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const NOTIFICATION_CONFIG: Record<string, { icon: string; color: string; BG: string }> = {
  like: { icon: "heart", color: "#ef4444", BG: "#fef2f2" },
  comment: { icon: "chatbubble", color: "#3b82f6", BG: "#eff6ff" },
  repost: { icon: "repeat", color: "#22c55e", BG: "#f0fdf4" },
  follow: { icon: "person-add", color: "#8b5cf6", BG: "#f5f3ff" },
  mention: { icon: "at", color: "#f59e0b", BG: "#fffbeb" },
  event: { icon: "calendar", color: "#06b6d4", BG: "#ecfeff" },
  event_reminder: { icon: "alarm", color: "#f97316", BG: "#fff7ed" },
  dm: { icon: "chatbubbles", color: "#6366f1", BG: "#eef2ff" },
  club_announcement: { icon: "megaphone", color: "#14b8a6", BG: "#f0fdfa" },
  report_resolved: { icon: "checkmark-circle", color: "#22c55e", BG: "#f0fdf4" },
  report_new: { icon: "flag", color: "#ef4444", BG: "#fef2f2" },
  system: { icon: "information-circle", color: "#6b7280", BG: "#f9fafb" },
};

function getNotificationRoute(item: Notification): string | null {
  const data = item.data as Record<string, string> | null;

  switch (item.type) {
    case "like":
    case "repost":
    case "mention":
      return data?.post_id ? `/post/${data.post_id}` : null;

    case "comment":
      return data?.post_id ? `/post/${data.post_id}` : null;

    case "follow":
      return null;

    case "event":
    case "event_reminder":
      return data?.event_id ? `/events/${data.event_id}` : null;

    case "dm":
      return data?.conversation_id ? `/(tabs)/messages/${data.conversation_id}` : null;

    case "club_announcement":
      if (data?.club_id) return `/clubs/${data.club_id}`;
      if (data?.post_id) return `/post/${data.post_id}`;
      return null;

    case "report_new":
    case "report_resolved":
    case "system":
      return null;

    default:
      return null;
  }
}

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const wsClientRef = useRef<WSClient | null>(null);
  const [localNotifications, setLocalNotifications] = useState<Notification[] | null>(null);

  const { data, refetch, isRefetching } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get<{ items: Notification[] }>("/notifications"),
  });

  useEffect(() => {
    let unsub: (() => void) | undefined;

    (async () => {
      try {
        const client = await getWSClient();
        wsClientRef.current = client;
        client.connect();
        unsub = client.on<Notification>("notification", (notification) => {
          setLocalNotifications((prev) => {
            if (prev === null) return prev;
            return [notification, ...prev];
          });
        });
      } catch {
        // WebSocket unavailable
      }
    })();

    return () => {
      unsub?.();
      if (wsClientRef.current) {
        releaseWSClient();
        wsClientRef.current = null;
      }
    };
  }, []);

  const markReadMutation = useMutation({
    mutationFn: () => api.patch("/notifications/read-all"),
    onSuccess: () => {
      setLocalNotifications((prev) =>
        prev?.map((n) => ({ ...n, is_read: true })) ?? prev
      );
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unreadCount"] });
    },
  });

  const handlePress = useCallback((item: Notification) => {
    if (!item.is_read) {
      api.patch("/notifications/mark-read", { notification_ids: [item.id] }).catch(() => {});
      setLocalNotifications((prev) =>
        prev?.map((n) => n.id === item.id ? { ...n, is_read: true } : n) ?? prev
      );
      queryClient.invalidateQueries({ queryKey: ["unreadCount"] });
    }
    const route = getNotificationRoute(item);
    if (route) {
      router.push(route as any);
    }
  }, [queryClient]);

  const notifications = localNotifications ?? data?.items ?? [];

  const renderItem = ({ item }: { item: Notification }) => {
    const config = NOTIFICATION_CONFIG[item.type] || NOTIFICATION_CONFIG.system;
    const route = getNotificationRoute(item);

    return (
      <TouchableOpacity
        style={[
          styles.item,
          { borderBottomColor: colors.border },
          !item.is_read && { backgroundColor: colors.primary + "08" },
        ]}
        onPress={() => handlePress(item)}
        activeOpacity={route ? 0.7 : 1}
      >
        {/* Icon badge */}
        <View style={[styles.iconBadge, { backgroundColor: config.BG }]}>
          <Avatar uri={item.actor?.avatar_url} name={item.actor?.display_name || "S"} size="sm" />
          <View style={[styles.iconDot, { backgroundColor: config.color }]}>
            <Ionicons name={config.icon as any} size={10} color="#fff" />
          </View>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={[styles.text, { color: colors.textPrimary }]} numberOfLines={3}>
            {item.title}
          </Text>
          {item.body && (
            <Text style={[styles.body, { color: colors.textSecondary }]} numberOfLines={2}>
              {item.body}
            </Text>
          )}
          <Text style={[styles.time, { color: colors.textTertiary }]}>
            {getRelativeTime(item.created_at)}
          </Text>
        </View>

        {/* Unread dot */}
        {!item.is_read && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}

        {/* Chevron */}
        {route && (
          <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
        )}
      </TouchableOpacity>
    );
  };

  const hasUnread = notifications.some((n) => !n.is_read);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Notifications</Text>
        {hasUnread ? (
          <Pressable
            onPress={() => markReadMutation.mutate()}
            disabled={markReadMutation.isPending}
            style={({ pressed }) => [
              styles.markAllBtn,
              { backgroundColor: colors.primary + "15" },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={[styles.markAllText, { color: colors.primary }]}>
              {markReadMutation.isPending ? "..." : "Read all"}
            </Text>
          </Pressable>
        ) : (
          <View style={styles.backBtn} />
        )}
      </View>

      {/* List */}
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => {
              setLocalNotifications(null);
              refetch();
            }}
          />
        }
        contentContainerStyle={notifications.length === 0 ? styles.emptyContainer : undefined}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={48} color={colors.textTertiary} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No notifications yet</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              When someone interacts with your posts, you'll see it here.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title: { fontSize: fontSize.xl, fontWeight: "700" },
  markAllBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 8,
  },
  markAllText: { fontSize: fontSize.sm, fontWeight: "600" },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  iconDot: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  content: { flex: 1 },
  text: { fontSize: fontSize.md, lineHeight: 20, fontWeight: "500" },
  body: { fontSize: fontSize.sm, marginTop: 2 },
  time: { fontSize: fontSize.xs, marginTop: 4 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  emptyContainer: { flex: 1 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingHorizontal: spacing.xl },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: "600", marginTop: spacing.md },
  emptySubtitle: { fontSize: fontSize.md, textAlign: "center", lineHeight: 22 },
});
