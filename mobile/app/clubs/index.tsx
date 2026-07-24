import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Animated,
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Pressable,
  RefreshControl,
  TextInput,
  Alert,
  Image,
  ScrollView,
  Dimensions,
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
import type { Club } from "../../types";

const CATEGORY_MAP: Record<string, string> = {
  tech: "Technology",
  academic: "Academic",
  cultural: "Arts & Culture",
  social: "Social",
  sports: "Sports",
  political: "Political",
  religious: "Religious",
  other: "General",
};

const CATEGORY_ICONS: Record<string, string> = {
  tech: "laptop-outline",
  academic: "school-outline",
  cultural: "color-palette-outline",
  social: "heart-outline",
  sports: "football-outline",
  political: "megaphone-outline",
  religious: "book-outline",
  other: "grid-outline",
};

const CATEGORIES = ["All", "tech", "academic", "cultural", "social", "sports", "political", "religious", "other"];

function getInitials(name: string): string {
  return (name || "?").split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase();
}

const FEATURED_WIDTH = Dimensions.get("window").width;
const FEATURED_HEIGHT = 220;
const FEATURED_INSET = spacing.xxl;
const AUTO_SCROLL_INTERVAL = 3500;

export default function ClubsScreen() {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [showMyClubs, setShowMyClubs] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { scrollProgress } = useScrollHide();
  const lastScrollY = useRef(0);
  const hiddenAmount = useRef(0);

  const { data, refetch, isRefetching } = useQuery({
    queryKey: ["clubs"],
    queryFn: () => api.get<Club[]>("/clubs"),
  });

  const clubs = data || [];
  const featured = clubs.filter((c) => c.is_premium || c.is_verified).slice(0, 5);
  const myClubs = clubs.filter((c) => c.is_member || c.is_pending);

  const joinMutation = useMutation({
    mutationFn: (clubId: string) => api.post(`/clubs/${clubId}/join`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clubs"] }),
  });

  const leaveMutation = useMutation({
    mutationFn: (clubId: string) => api.delete(`/clubs/${clubId}/join`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clubs"] }),
  });

  // Auto-scroll featured carousel
  useEffect(() => {
    if (featured.length <= 1 || isPaused) return;
    const timer = setInterval(() => {
      const next = (activeSlide + 1) % featured.length;
      flatListRef.current?.scrollToOffset({ offset: next * FEATURED_WIDTH, animated: true });
      setActiveSlide(next);
    }, AUTO_SCROLL_INTERVAL);
    return () => clearInterval(timer);
  }, [activeSlide, featured.length, isPaused]);

  const handleScrollBegin = useCallback(() => {
    setIsPaused(true);
    if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
  }, []);

  const handleScrollEnd = useCallback(() => {
    pauseTimerRef.current = setTimeout(() => setIsPaused(false), 5000);
  }, []);

  const onFeaturedScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / FEATURED_WIDTH);
    setActiveSlide(index);
  }, []);

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

  const filtered = clubs.filter((c) => {
    if (showMyClubs && !c.is_member) return false;
    if (cat !== "All" && c.category !== cat) return false;
    if (q.trim() && !c.name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const renderFeaturedCard = (club: Club) => (
    <TouchableOpacity
      key={club.id}
      style={[styles.featuredCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.push(`/clubs/${club.slug}`)}
      activeOpacity={0.7}
    >
      {club.banner_url ? (
        <Image source={{ uri: club.banner_url }} style={styles.featuredBanner} />
      ) : (
        <View style={[styles.featuredBannerPlaceholder, { backgroundColor: colors.primary + "15" }]}>
          <Ionicons name={CATEGORY_ICONS[club.category] || "people-outline"} size={32} color={colors.primary + "40"} />
        </View>
      )}
      <View style={[styles.featuredOverlay, { backgroundColor: "rgba(0,0,0,0.45)" }]}>
        <View style={styles.featuredBages}>
          {club.is_premium && (
            <View style={[styles.premiumBadge, { backgroundColor: "#f59e0b" }]}>
              <Ionicons name="star" size={10} color="#fff" />
              <Text style={styles.premiumBadgeText}>Premium</Text>
            </View>
          )}
          {club.is_verified && (
            <Ionicons name="checkmark-circle" size={14} color="#38bdf8" />
          )}
        </View>
        <Text style={styles.featuredName} numberOfLines={1}>{club.name}</Text>
        <Text style={styles.featuredMeta}>
          {CATEGORY_MAP[club.category] || club.category} · {club.member_count} members
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderMyClubCard = (club: Club) => (
    <TouchableOpacity
      key={club.id}
      style={[styles.myClubCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.push(`/clubs/${club.slug}`)}
      activeOpacity={0.7}
    >
      <View style={[styles.myClubAvatar, { backgroundColor: colors.primary + "15" }]}>
        <Text style={[styles.myClubInitials, { color: colors.primary }]}>{getInitials(club.name)}</Text>
      </View>
      <Text style={[styles.myClubName, { color: colors.textPrimary }]} numberOfLines={1}>{club.name}</Text>
      <Text style={[styles.myClubMembers, { color: colors.textSecondary }]}>{club.member_count}</Text>
    </TouchableOpacity>
  );

  const renderClubCard = ({ item }: { item: Club }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.push(`/clubs/${item.slug}`)}
      activeOpacity={0.7}
    >
      {/* Banner */}
      {item.banner_url ? (
        <Image source={{ uri: item.banner_url }} style={styles.cardBanner} />
      ) : (
        <View style={[styles.cardBannerPlaceholder, { backgroundColor: colors.primary + "10" }]}>
          <Ionicons name={CATEGORY_ICONS[item.category] || "people-outline"} size={24} color={colors.primary + "30"} />
        </View>
      )}

      <View style={styles.cardBody}>
        {/* Avatar + Name */}
        <View style={styles.cardHeader}>
          <View style={[styles.cardAvatar, { borderColor: colors.background }]}>
            {item.logo_url ? (
              <Image source={{ uri: item.logo_url }} style={styles.cardAvatarImage} />
            ) : (
              <View style={[styles.cardAvatarPlaceholder, { backgroundColor: colors.primary + "20" }]}>
                <Text style={[styles.cardAvatarInitials, { color: colors.primary }]}>{getInitials(item.name)}</Text>
              </View>
            )}
          </View>
          <View style={styles.cardInfo}>
            <View style={styles.clubNameRow}>
              <Text style={[styles.clubName, { color: colors.textPrimary }]} numberOfLines={1}>
                {item.name}
              </Text>
              {item.is_verified && (
                <Ionicons name="checkmark-circle" size={14} color="#38bdf8" />
              )}
              {item.is_premium && (
                <Ionicons name="star" size={12} color="#f59e0b" />
              )}
            </View>
            <View style={styles.clubMeta}>
              <View style={[styles.categoryBadge, { backgroundColor: colors.primary + "15" }]}>
                <Text style={[styles.categoryText, { color: colors.primary }]}>
                  {CATEGORY_MAP[item.category] || item.category}
                </Text>
              </View>
              <Text style={[styles.memberCount, { color: colors.textSecondary }]}>
                {item.member_count} members
              </Text>
            </View>
          </View>
        </View>

        {/* Description */}
        {item.description ? (
          <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}

        {/* Join button */}
        <Pressable
          style={[
            styles.joinButton,
            {
              backgroundColor: item.is_member ? "transparent" : item.is_pending ? colors.warning + "20" : colors.primary,
              borderColor: item.is_member ? colors.border : item.is_pending ? colors.warning : colors.primary,
            },
          ]}
          onPress={(e) => {
            e.stopPropagation();
            if (item.is_member) {
              Alert.alert("Leave Club", "Are you sure you want to leave?", [
                { text: "Cancel", style: "cancel" },
                { text: "Leave", style: "destructive", onPress: () => leaveMutation.mutate(item.id) },
              ]);
            } else if (item.is_pending) {
              Alert.alert("Request Pending", "Your join request is awaiting approval.");
            } else {
              joinMutation.mutate(item.id);
            }
          }}
        >
          <Text
            style={[
              styles.joinText,
              { color: item.is_member ? colors.textSecondary : item.is_pending ? colors.warning : colors.primaryForeground },
            ]}
          >
            {item.is_member ? "Joined" : item.is_pending ? "Pending" : "Join"}
          </Text>
        </Pressable>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Clubs</Text>
        <TouchableOpacity onPress={() => router.push("/clubs/create")}>
          <Ionicons name="add-circle" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={[styles.searchContainer]}>
        <View style={[styles.searchInput, { borderColor: colors.border, backgroundColor: colors.background }]}>
          <Ionicons name="search" size={16} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchText, { color: colors.textPrimary }]}
            placeholder="Search clubs..."
            placeholderTextColor={colors.textSecondary}
            value={q}
            onChangeText={setQ}
          />
          {q.length > 0 && (
            <TouchableOpacity onPress={() => setQ("")}>
              <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderClubCard}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        contentContainerStyle={[styles.list]}
        ListHeaderComponent={
          <>
            {/* Category Chips — Horizontal Scroll */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryScroll}
            >
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.categoryChip,
                    {
                      backgroundColor: cat === c ? colors.primary : colors.card,
                      borderColor: cat === c ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setCat(c)}
                >
                  {c !== "All" && (
                    <Ionicons
                      name={(CATEGORY_ICONS[c] || "grid-outline") as any}
                      size={13}
                      color={cat === c ? colors.primaryForeground : colors.textSecondary}
                    />
                  )}
                  <Text
                    style={[
                      styles.categoryChipText,
                      { color: cat === c ? colors.primaryForeground : colors.textSecondary },
                    ]}
                  >
                    {c === "All" ? "All" : CATEGORY_MAP[c] || c}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* My Clubs Toggle */}
            {myClubs.length > 0 && (
              <View style={styles.myClubsSection}>
                <View style={styles.myClubsHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>My Clubs</Text>
                  <TouchableOpacity onPress={() => setShowMyClubs(!showMyClubs)}>
                    <Text style={[styles.seeAllText, { color: colors.primary }]}>
                      {showMyClubs ? "Show All" : "See All"}
                    </Text>
                  </TouchableOpacity>
                </View>
                {!showMyClubs && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.myClubsScroll}
                  >
                    {myClubs.map(renderMyClubCard)}
                  </ScrollView>
                )}
              </View>
            )}

            {/* Featured Clubs — Auto-scrolling Slideshow */}
            {featured.length > 0 && !showMyClubs && cat === "All" && !q.trim() && (
              <View style={[styles.featuredSection, { marginHorizontal: -spacing.lg }]}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary, paddingHorizontal: spacing.lg }]}>Featured</Text>
                <FlatList
                  ref={flatListRef}
                  data={featured}
                  keyExtractor={(item) => item.id}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  snapToInterval={FEATURED_WIDTH}
                  decelerationRate="fast"
                  onMomentumScrollEnd={onFeaturedScroll}
                  onScrollBeginDrag={handleScrollBegin}
                  onScrollEndDrag={handleScrollEnd}
                  renderItem={({ item: club }) => (
                    <View style={{ width: FEATURED_WIDTH, alignItems: "center" }}>
                      <TouchableOpacity
                        style={[styles.featuredCard, { width: FEATURED_WIDTH - FEATURED_INSET * 2, height: FEATURED_HEIGHT, backgroundColor: colors.card, borderColor: colors.border }]}
                        onPress={() => router.push(`/clubs/${club.slug}`)}
                        activeOpacity={0.8}
                      >
                        <View style={styles.featuredBannerWrap}>
                          {club.banner_url ? (
                            <Image source={{ uri: club.banner_url }} style={styles.featuredBanner} />
                          ) : (
                            <View style={[styles.featuredBannerPlaceholder, { backgroundColor: colors.primary + "12" }]}>
                              <Ionicons name={CATEGORY_ICONS[club.category] || "people-outline"} size={40} color={colors.primary + "30"} />
                            </View>
                          )}
                        </View>
                        <View style={styles.featuredContent}>
                          <View style={styles.featuredBages}>
                            {club.is_premium && (
                              <View style={[styles.premiumBadge, { backgroundColor: "#f59e0b" }]}>
                                <Ionicons name="star" size={10} color="#fff" />
                                <Text style={styles.premiumBadgeText}>Premium</Text>
                              </View>
                            )}
                            {club.is_verified && (
                              <Ionicons name="checkmark-circle" size={14} color="#38bdf8" />
                            )}
                          </View>
                          <Text style={[styles.featuredName, { color: colors.textPrimary }]} numberOfLines={1}>{club.name}</Text>
                          <Text style={[styles.featuredMeta, { color: colors.textSecondary }]}>
                            {CATEGORY_MAP[club.category] || club.category} · {club.member_count} members
                          </Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  )}
                />
                {/* Pagination dots */}
                {featured.length > 1 && (
                  <View style={styles.pagination}>
                    {featured.map((_, i) => (
                      <View
                        key={i}
                        style={[
                          styles.dot,
                          { backgroundColor: i === activeSlide ? colors.primary : colors.border },
                        ]}
                      />
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Section title for full list */}
            <View style={styles.listHeader}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                {showMyClubs ? "My Clubs" : cat !== "All" ? CATEGORY_MAP[cat] : "All Clubs"}
              </Text>
              <Text style={[styles.countText, { color: colors.textSecondary }]}>
                {filtered.length}
              </Text>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={40} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {showMyClubs
                ? "You haven't joined any clubs yet."
                : q
                  ? "No clubs found."
                  : "No clubs yet."}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const CARD_BANNER_HEIGHT = 100;
const MY_CLUB_SIZE = 96;

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
  title: { fontSize: fontSize.lg, fontWeight: "600" },
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
  searchText: { flex: 1, fontSize: fontSize.sm },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },

  // Category chips
  categoryScroll: { gap: spacing.xs, paddingVertical: spacing.sm },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  categoryChipText: { fontSize: fontSize.xs, fontWeight: "500" },

  // My Clubs section
  myClubsSection: { marginTop: spacing.sm },
  myClubsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  myClubsScroll: { gap: spacing.sm, paddingBottom: spacing.sm },
  myClubCard: {
    width: MY_CLUB_SIZE,
    alignItems: "center",
    padding: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    gap: 4,
  },
  myClubAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  myClubInitials: { fontSize: fontSize.sm, fontWeight: "700" },
  myClubName: { fontSize: 11, fontWeight: "600", textAlign: "center" },
  myClubMembers: { fontSize: 10 },

  // Featured carousel
  featuredSection: { marginTop: spacing.sm },
  featuredCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  featuredBannerWrap: {
    height: 130,
  },
  featuredBanner: {
    width: "100%",
    height: "100%",
  },
  featuredBannerPlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  featuredContent: { padding: spacing.md },
  featuredBages: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: 4 },
  premiumBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  premiumBadgeText: { fontSize: 9, fontWeight: "700", color: "#fff" },
  featuredName: { fontSize: fontSize.md, fontWeight: "700" },
  featuredMeta: { fontSize: fontSize.xs, marginTop: 2 },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
    marginTop: spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  // List header
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  sectionTitle: { fontSize: fontSize.md, fontWeight: "700" },
  seeAllText: { fontSize: fontSize.sm, fontWeight: "500" },
  countText: { fontSize: fontSize.sm },

  // Club card
  card: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: spacing.md,
  },
  cardBanner: { width: "100%", height: CARD_BANNER_HEIGHT },
  cardBannerPlaceholder: {
    width: "100%",
    height: CARD_BANNER_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: { padding: spacing.md },
  cardHeader: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  cardAvatar: {
    marginTop: -20,
    borderWidth: 2,
    borderRadius: borderRadius.lg,
    overflow: "hidden",
  },
  cardAvatarImage: { width: 44, height: 44, borderRadius: borderRadius.lg },
  cardAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  cardAvatarInitials: { fontSize: fontSize.md, fontWeight: "700" },
  cardInfo: { flex: 1 },
  clubNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  clubName: { fontSize: fontSize.md, fontWeight: "600", flex: 1 },
  clubMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: 2,
  },
  categoryBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  categoryText: { fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  memberCount: { fontSize: fontSize.xs },
  description: { fontSize: fontSize.sm, lineHeight: 20, marginBottom: spacing.sm },
  joinButton: {
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    alignItems: "center",
  },
  joinText: { fontSize: fontSize.sm, fontWeight: "600" },
  empty: {
    alignItems: "center",
    paddingVertical: spacing.xxl * 3,
    gap: spacing.md,
  },
  emptyText: { fontSize: fontSize.md, textAlign: "center" },
});
