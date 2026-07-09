import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Image,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useInfiniteQuery } from "@tanstack/react-query";
import { api } from "../../lib/api-client";
import { useAuth } from "../../hooks/useAuth";
import { useUnreadNotificationCount } from "../../hooks/useUnreadNotificationCount";
import { useTheme } from "../../lib/theme-context";
import { useScrollHide } from "../../lib/scroll-context";
import { PostCard } from "../../components/PostCard";
import { Avatar } from "../../components/Avatar";
import { spacing, fontSize } from "../../lib/theme";
import type { Post, PaginatedResponse } from "../../types";

export default function FeedScreen() {
  const { user } = useAuth();
  const { colors, resolvedTheme } = useTheme();
  const unreadCount = useUnreadNotificationCount();
  const { scrollProgress } = useScrollHide();
  const lastScrollY = useRef(0);
  const hiddenAmount = useRef(0);
  const [tab, setTab] = useState<"for_you" | "faculty">("for_you");
  const [refreshing, setRefreshing] = useState(false);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["feed", tab],
    queryFn: ({ pageParam }) =>
      api.get<PaginatedResponse<Post>>("/posts", {
        params: {
          ...(pageParam ? { cursor: pageParam } : {}),
          limit: "20",
          ...(tab === "faculty" ? { faculty_only: "true" } : {}),
        },
      }),
    getNextPageParam: (lastPage) => lastPage.next_cursor || undefined,
    initialPageParam: "",
  });

  const posts = data?.pages.flatMap((p) => p.items) || [];

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const renderItem = useCallback(
    ({ item }: { item: Post }) => <PostCard post={item} />,
    []
  );

  const renderFooter = () => {
    if (!hasNextPage || isFetchingNextPage) return null;
    return <ActivityIndicator style={styles.footer} />;
  };

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const currentY = e.nativeEvent.contentOffset.y;
      const diff = currentY - lastScrollY.current;
      lastScrollY.current = currentY;
      if (diff > 0) {
        hiddenAmount.current = Math.min(1, hiddenAmount.current + diff / 60);
      } else {
        hiddenAmount.current = Math.max(0, hiddenAmount.current + diff / 60);
      }
      if (currentY <= 0) hiddenAmount.current = 0;
      scrollProgress.setValue(hiddenAmount.current);
    },
    [scrollProgress]
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { borderBottomColor: colors.border },
        ]}
      >
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => router.push("/(tabs)/compose")}>
            <Ionicons name="add-circle-outline" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/(tabs)/notifications")} style={styles.notifBtn}>
            <Ionicons name="notifications-outline" size={22} color={colors.textSecondary} />
            {unreadCount > 0 && (
              <View style={[styles.notifBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.notifBadgeText}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Image 
              source={resolvedTheme === 'dark' ? require('../../assets/logo-white.png') : require('../../assets/logo-red.png')} 
              style={{ width: 32, height: 32 }} 
              resizeMode="contain" 
            />
          </View>
          <TouchableOpacity onPress={() => router.push("/(tabs)/explore")}>
            <Ionicons name="search" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/settings")}>
            <Ionicons name="settings-outline" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View
        style={[
          styles.tabs,
          { borderBottomColor: colors.border },
        ]}
      >
        {(["for_you", "faculty"] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && { borderBottomColor: colors.primary }]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, { color: tab === t ? colors.primary : colors.textSecondary }]}>
              {t === "for_you" ? "For You" : "Faculty"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Feed */}
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 80 }}
        ListHeaderComponent={
          <TouchableOpacity
            style={[styles.composeBox, { borderBottomColor: colors.border }]}
            onPress={() => router.push("/compose")}
            activeOpacity={0.7}
          >
            <Avatar uri={user?.profile?.avatar_url} name={user?.profile?.display_name || user?.email || "U"} size="md" />
            <Text style={[styles.composePlaceholder, { color: colors.textTertiary }]}>
              What's on your mind?
            </Text>
          </TouchableOpacity>
        }
        onEndReached={() => hasNextPage && fetchNextPage()}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      />
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  notifBtn: {
    position: "relative",
  },
  notifBadge: {
    position: "absolute",
    right: -4,
    top: -4,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  notifBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  tabs: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
  },
  composeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  composePlaceholder: {
    fontSize: 15,
    flex: 1,
  },
  footer: {
    paddingVertical: 20,
  },
});
