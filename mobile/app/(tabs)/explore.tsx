import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { api } from "../../lib/api-client";
import { useTheme } from "../../lib/theme-context";
import { Avatar } from "../../components/Avatar";
import { PostCard } from "../../components/PostCard";
import { Ionicons } from "@expo/vector-icons";
import { spacing, fontSize, borderRadius } from "../../lib/theme";
import type { User, Post, Event, Club } from "../../types";

type SearchTab = "top" | "users" | "posts" | "clubs" | "events" | "marketplace";

const TABS: { key: SearchTab; label: string; icon: string }[] = [
  { key: "top", label: "Top", icon: "trending-up" },
  { key: "users", label: "People", icon: "people" },
  { key: "posts", label: "Posts", icon: "document-text" },
  { key: "clubs", label: "Clubs", icon: "people-circle" },
  { key: "events", label: "Events", icon: "calendar" },
  { key: "marketplace", label: "Shop", icon: "pricetag" },
];

export default function SearchScreen() {
  const { colors } = useTheme();
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<SearchTab>("top");

  const { data: searchResults, refetch, isRefetching } = useQuery({
    queryKey: ["search", query, activeTab],
    queryFn: () =>
      api.get<{
        users: User[];
        posts: Post[];
        clubs: Club[];
        events: Event[];
        listings: any[];
      }>("/search", {
        params: {
          q: query,
          ...(activeTab !== "top" ? { type: activeTab } : {}),
        },
      }),
    enabled: !!query.trim(),
  });

  const users = searchResults?.users || [];
  const posts = (searchResults?.posts || []).map((p: any) => ({
    ...p,
    author: p.author || {
      id: p.author_id,
      email: "",
      role: "student",
      is_verified: false,
      profile: { display_name: p.author_name, avatar_url: null },
    },
    is_liked: p.is_liked ?? false,
    is_saved: p.is_saved ?? false,
    is_reposted: p.is_reposted ?? false,
    share_count: p.share_count ?? 0,
    like_count: p.like_count ?? 0,
    comment_count: p.comment_count ?? 0,
    media: p.media ?? [],
    faculty_only: p.faculty_only ?? false,
    edited_at: p.edited_at ?? null,
  }));
  const clubs = searchResults?.clubs || [];
  const events = searchResults?.events || [];
  const listings = searchResults?.listings || [];

  const renderUserItem = ({ item }: { item: User }) => {
    const handle = item.username || item.email?.split("@")[0] || "";
    return (
      <TouchableOpacity
        style={[styles.resultItem, { borderBottomColor: colors.border }]}
        onPress={() => router.push(`/profile/${item.id}`)}
      >
        <Avatar uri={item.avatar_url || item.profile?.avatar_url} name={item.display_name || item.profile?.display_name || item.email} size="md" />
        <View style={styles.resultInfo}>
          <View style={styles.nameRow}>
            <Text style={[styles.resultName, { color: colors.textPrimary }]}>{item.display_name || item.profile?.display_name || item.email}</Text>
            {item.role === "admin" && (
              <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
            )}
          </View>
          <Text style={[styles.resultSub, { color: colors.textSecondary }]}>@{handle}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderClubItem = ({ item }: { item: Club }) => (
    <TouchableOpacity
      style={[styles.resultItem, { borderBottomColor: colors.border }]}
      onPress={() => router.push(`/clubs/${item.slug}`)}
    >
      <View style={[styles.clubIcon, { backgroundColor: colors.primary + "20" }]}>
        <Ionicons name="people-circle" size={32} color={colors.primary} />
      </View>
      <View style={styles.resultInfo}>
        <Text style={[styles.resultName, { color: colors.textPrimary }]}>{item.name}</Text>
        <Text style={[styles.resultSub, { color: colors.textSecondary }]}>{item.member_count} members</Text>
      </View>
    </TouchableOpacity>
  );

  const renderEventItem = ({ item }: { item: Event }) => (
    <TouchableOpacity
      style={[styles.resultItem, { borderBottomColor: colors.border }]}
      onPress={() => router.push(`/events/${item.id}`)}
    >
      <View style={[styles.eventIcon, { backgroundColor: colors.success + "20" }]}>
        <Ionicons name="calendar" size={32} color={colors.success} />
      </View>
      <View style={styles.resultInfo}>
        <Text style={[styles.resultName, { color: colors.textPrimary }]}>{item.title}</Text>
        <Text style={[styles.resultSub, { color: colors.textSecondary }]}>
          {new Date(item.start_time).toLocaleDateString()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderListingItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={[styles.resultItem, { borderBottomColor: colors.border }]}
      onPress={() => router.push(`/marketplace/${item.id}`)}
    >
      <View style={[styles.eventIcon, { backgroundColor: colors.warning + "20" }]}>
        <Ionicons name="pricetag" size={32} color={colors.warning} />
      </View>
      <View style={styles.resultInfo}>
        <Text style={[styles.resultName, { color: colors.textPrimary }]} numberOfLines={1}>{item.title}</Text>
        <Text style={[styles.resultSub, { color: colors.textSecondary }]} numberOfLines={1}>
          {item.price ? `₹${item.price.toFixed(2)}` : "Free"}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderItem = ({ item }: { item: any }) => {
    switch (activeTab) {
      case "users":
        return renderUserItem({ item });
      case "clubs":
        return renderClubItem({ item });
      case "events":
        return renderEventItem({ item });
      case "posts":
        return <PostCard post={item} />;
      case "marketplace":
        return renderListingItem({ item });
      default:
        return null;
    }
  };

  const getData = () => {
    switch (activeTab) {
      case "users":
        return users;
      case "posts":
        return posts;
      case "clubs":
        return clubs;
      case "events":
        return events;
      case "marketplace":
        return listings;
      default:
        return [];
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Search bar */}
      <View style={[styles.searchBar, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 8 }}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Ionicons name="search" size={20} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.textPrimary }]}
          placeholder="Search people, posts, clubs, events..."
          placeholderTextColor={colors.textSecondary}
          value={query}
          onChangeText={setQuery}
          autoFocus
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery("")}>
            <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={TABS}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.tab, activeTab === item.key && { borderBottomColor: colors.primary }]}
              onPress={() => setActiveTab(item.key)}
            >
              <Text
                style={[styles.tabText, { color: activeTab === item.key ? colors.primary : colors.textSecondary }]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Results */}
      {query.trim() ? (
        <FlatList
          data={getData()}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 80 }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="search-outline" size={40} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No results for "{query}"
              </Text>
            </View>
          }
          ListHeaderComponent={
            activeTab === "top" ? (
              <View style={styles.topResults}>
                {users.length > 0 && (
                  <View style={styles.topSection}>
                    <View style={styles.sectionHeader}>
                      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>People</Text>
                      <TouchableOpacity onPress={() => setActiveTab("users")}>
                        <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
                      </TouchableOpacity>
                    </View>
                    {users.slice(0, 3).map((user) => renderUserItem({ item: user }))}
                  </View>
                )}
                {clubs.length > 0 && (
                  <View style={styles.topSection}>
                    <View style={styles.sectionHeader}>
                      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Clubs</Text>
                      <TouchableOpacity onPress={() => setActiveTab("clubs")}>
                        <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
                      </TouchableOpacity>
                    </View>
                    {clubs.slice(0, 3).map((club) => renderClubItem({ item: club }))}
                  </View>
                )}
                {events.length > 0 && (
                  <View style={styles.topSection}>
                    <View style={styles.sectionHeader}>
                      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Events</Text>
                      <TouchableOpacity onPress={() => setActiveTab("events")}>
                        <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
                      </TouchableOpacity>
                    </View>
                    {events.slice(0, 3).map((event) => renderEventItem({ item: event }))}
                  </View>
                )}
                {posts.length > 0 && (
                  <View style={styles.topSection}>
                    <View style={styles.sectionHeader}>
                      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Posts</Text>
                      <TouchableOpacity onPress={() => setActiveTab("posts")}>
                        <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
                      </TouchableOpacity>
                    </View>
                    {posts.slice(0, 3).map((post) => (
                      <PostCard key={post.id} post={post} />
                    ))}
                  </View>
                )}
              </View>
            ) : null
          }
        />
      ) : (
        /* Empty state when no query */
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={64} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Search Campus Connect</Text>
          <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
            {activeTab === "top" && "Find people, posts, clubs, events, and marketplace items"}
            {activeTab === "users" && "Type a name to find people"}
            {activeTab === "posts" && "Type to find posts"}
            {activeTab === "clubs" && "Type to find clubs"}
            {activeTab === "events" && "Type to find events"}
            {activeTab === "marketplace" && "Type to find marketplace items"}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.md,
  },
  tabs: {
    borderBottomWidth: 1,
  },
  tab: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabText: {
    fontSize: fontSize.sm,
    fontWeight: "500",
  },
  topResults: {
    paddingVertical: spacing.md,
  },
  topSection: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: "600",
  },
  seeAll: {
    fontSize: fontSize.sm,
    fontWeight: "500",
  },
  resultItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    gap: spacing.md,
  },
  resultInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  resultName: {
    fontSize: fontSize.md,
    fontWeight: "600",
  },
  resultSub: {
    fontSize: fontSize.sm,
  },
  clubIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  eventIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    alignItems: "center",
    paddingVertical: spacing.xxl * 3,
    gap: spacing.md,
  },
  emptyText: {
    fontSize: fontSize.md,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.xxl,
  },
  emptyTitle: {
    fontSize: fontSize.xl,
    fontWeight: "600",
  },
  emptySub: {
    fontSize: fontSize.md,
    textAlign: "center",
  },
});
