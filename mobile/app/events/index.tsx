import React, { useState, useCallback, useRef } from "react";
import {
  Animated,
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Image,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { api } from "../../lib/api-client";
import { useTheme } from "../../lib/theme-context";
import { useScrollHide } from "../../lib/scroll-context";
import { Ionicons } from "@expo/vector-icons";
import { spacing, fontSize, borderRadius } from "../../lib/theme";
import type { Event } from "../../types";

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDayMonth(dateString: string): { day: string; month: string } {
  const date = new Date(dateString);
  return {
    day: date.getDate().toString(),
    month: date.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
  };
}

const RSVP_COLORS: Record<string, string> = {
  going: "#22c55e",
  maybe: "#f59e0b",
  not_going: "#ef4444",
};

const TABS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "my", label: "My Events" },
  { key: "saved", label: "Saved" },
  { key: "past", label: "Past" },
];

export default function EventsScreen() {
  const { colors } = useTheme();
  const [tab, setTab] = useState<"upcoming" | "my" | "saved" | "past">("upcoming");
  const [search, setSearch] = useState("");
  const { scrollProgress } = useScrollHide();
  const lastScrollY = useRef(0);
  const hiddenAmount = useRef(0);

  const { data, refetch, isRefetching } = useQuery({
    queryKey: ["events", tab, search],
    queryFn: () =>
      api.get<Event[]>("/events", {
        params: {
          ...(tab === "my" ? { my_events: "true" } : {}),
          ...(tab === "saved" ? { saved_only: "true" } : {}),
          ...(tab === "upcoming" ? { upcoming: "true" } : {}),
          ...(tab === "past" ? { past: "true" } : {}),
          ...(search ? { search } : {}),
        },
      }),
  });

  const events = data || [];
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: (payload: { id: string; isSaved: boolean }) =>
      payload.isSaved
        ? api.delete(`/events/${payload.id}/save`)
        : api.post(`/events/${payload.id}/save`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });

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

  const renderItem = ({ item }: { item: Event }) => {
    const { day, month } = getDayMonth(item.start_time);
    const rsvpColor = item.user_rsvp ? RSVP_COLORS[item.user_rsvp] : null;
    const spotsLeft = item.rsvp_limit ? item.rsvp_limit - item.rsvp_count : null;

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => router.push(`/events/${item.id}`)}
        activeOpacity={0.7}
      >
        {/* Cover image */}
        {item.cover_image_url ? (
          <Image source={{ uri: item.cover_image_url }} style={styles.coverImage} />
        ) : (
          <View style={[styles.coverPlaceholder, { backgroundColor: colors.primary + "10" }]}>
            <Ionicons name="calendar" size={32} color={colors.primary} />
          </View>
        )}

        <View style={styles.cardBody}>
          {/* Date block + content */}
          <View style={styles.cardRow}>
            {/* Date block */}
            <View style={[styles.dateBlock, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30" }]}>
              <Text style={[styles.dateMonth, { color: colors.primary }]}>{month}</Text>
              <Text style={[styles.dateDay, { color: colors.primary }]}>{day}</Text>
            </View>

            {/* Content */}
            <View style={styles.cardContent}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={2}>{item.title}</Text>
                {item.user_rsvp && rsvpColor && (
                  <View style={[styles.rsvpBadge, { backgroundColor: rsvpColor + "18" }]}>
                    <Text style={[styles.rsvpText, { color: rsvpColor }]}>
                      {item.user_rsvp === "not_going" ? "Can't Go" : item.user_rsvp}
                    </Text>
                  </View>
                )}
              </View>

              {/* Time */}
              <View style={styles.metaRow}>
                <Ionicons name="time-outline" size={13} color={colors.textSecondary} />
                <Text style={[styles.metaText, { color: colors.textSecondary }]}>{formatDate(item.start_time)}</Text>
              </View>

              {/* Location */}
              {item.location && (
                <View style={styles.metaRow}>
                  <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
                  <Text style={[styles.metaText, { color: colors.textSecondary }]} numberOfLines={1}>{item.location}</Text>
                </View>
              )}

              {/* Footer */}
              <View style={styles.cardFooter}>
                <View style={styles.attendees}>
                  <Ionicons name="people-outline" size={14} color={colors.textSecondary} />
                  <Text style={[styles.attendeesText, { color: colors.textSecondary }]}>
                    {item.rsvp_count} going
                  </Text>
                </View>
                <View style={styles.footerRight}>
                  {spotsLeft != null && spotsLeft <= 10 && (
                    <View style={[styles.spotsBadge, { backgroundColor: spotsLeft <= 3 ? "#ef4444" + "15" : "#f59e0b" + "15" }]}>
                      <Text style={[styles.spotsText, { color: spotsLeft <= 3 ? "#ef4444" : "#f59e0b" }]}>
                        {spotsLeft > 0 ? `${spotsLeft} left` : "Full"}
                      </Text>
                    </View>
                  )}
                  <TouchableOpacity
                    onPress={() => saveMutation.mutate({ id: item.id, isSaved: item.is_saved || false })}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name={item.is_saved ? "bookmark" : "bookmark-outline"}
                      size={18}
                      color={item.is_saved ? colors.primary : colors.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Events</Text>
        <TouchableOpacity onPress={() => router.push("/events/create")}>
          <Ionicons name="add-circle" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && { borderBottomColor: colors.primary }]}
            onPress={() => setTab(t.key as typeof tab)}
          >
            <Text
              style={[styles.tabText, { color: tab === t.key ? colors.primary : colors.textSecondary }]}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search */}
      <View style={[styles.searchContainer]}>
        <View style={[styles.searchInput, { borderColor: colors.border, backgroundColor: colors.background }]}>
          <Ionicons name="search" size={16} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchText, { color: colors.textPrimary }]}
            placeholder="Search events..."
            placeholderTextColor={colors.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {/* Events list */}
      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        contentContainerStyle={[styles.list]}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={40} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {tab === "my" ? "No events you're going to" : "No events yet"}
            </Text>
          </View>
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: "600",
  },
  tabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabText: {
    fontSize: fontSize.sm,
    fontWeight: "500",
  },
  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  searchInput: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  searchText: {
    flex: 1,
    fontSize: fontSize.sm,
  },
  list: {
    padding: spacing.lg,
  },
  card: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
    overflow: "hidden",
  },
  coverImage: {
    width: "100%",
    height: 140,
  },
  coverPlaceholder: {
    width: "100%",
    height: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: {
    padding: spacing.md,
  },
  cardRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  dateBlock: {
    width: 48,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    paddingVertical: 8,
  },
  dateMonth: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  dateDay: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 2,
  },
  cardContent: {
    flex: 1,
    gap: 4,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  cardTitle: {
    fontSize: fontSize.md,
    fontWeight: "600",
    flex: 1,
  },
  rsvpBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  rsvpText: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    flex: 1,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  footerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  attendees: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  attendeesText: {
    fontSize: 12,
  },
  spotsBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  spotsText: {
    fontSize: 10,
    fontWeight: "600",
  },
  empty: {
    alignItems: "center",
    paddingVertical: spacing.xxl * 3,
    gap: spacing.md,
  },
  emptyText: {
    fontSize: fontSize.md,
  },
});
