import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  ScrollView,
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
import { useAuth } from "../../hooks/useAuth";
import { useTheme } from "../../lib/theme-context";
import { useScrollHide } from "../../lib/scroll-context";
import { Ionicons } from "@expo/vector-icons";
import { spacing, fontSize, borderRadius } from "../../lib/theme";
import type { Listing } from "../../types";

const CATEGORIES = [
  { label: "All", icon: "grid-outline" as const },
  { label: "Textbooks", icon: "book-outline" as const },
  { label: "Electronics", icon: "hardware-chip-outline" as const },
  { label: "Accommodation", icon: "home-outline" as const },
  { label: "Tutoring", icon: "school-outline" as const },
  { label: "Clothing", icon: "shirt-outline" as const },
  { label: "Furniture", icon: "cube-outline" as const },
  { label: "Sports", icon: "football-outline" as const },
  { label: "Food", icon: "fast-food-outline" as const },
  { label: "Transport", icon: "car-outline" as const },
  { label: "Services", icon: "briefcase-outline" as const },
  { label: "Other", icon: "ellipsis-horizontal-outline" as const },
];

const SORT_OPTIONS = [
  { label: "Newest", value: "newest", icon: "time-outline" as const },
  { label: "Oldest", value: "oldest", icon: "hourglass-outline" as const },
  { label: "Price: Low", value: "price_low", icon: "trending-down-outline" as const },
  { label: "Price: High", value: "price_high", icon: "trending-up-outline" as const },
  { label: "Most Viewed", value: "views_desc", icon: "eye-outline" as const },
  { label: "Top Rated", value: "rating_desc", icon: "star-outline" as const },
];

const CONDITION_MAP: Record<string, { color: string; label: string }> = {
  new: { color: "#22c55e", label: "New" },
  like_new: { color: "#38bdf8", label: "Like New" },
  good: { color: "#f59e0b", label: "Good" },
  fair: { color: "#f97316", label: "Fair" },
  used: { color: "#6b7280", label: "Used" },
};

function getRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

type Tab = "browse" | "my" | "saved";

export default function MarketplaceScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === "admin";
  const [tab, setTab] = useState<Tab>("browse");
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [showSort, setShowSort] = useState(false);
  const [showPriceFilter, setShowPriceFilter] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const { scrollProgress } = useScrollHide();
  const lastScrollY = useRef(0);
  const hiddenAmount = useRef(0);

  const { data, refetch, isRefetching } = useQuery({
    queryKey: ["listings", tab, category, search, sort, user?.id, minPrice, maxPrice],
    queryFn: () =>
      api.get<{ items: Listing[] }>("/marketplace/listings", {
        params: {
          ...(tab === "my" && user?.id ? { seller_id: user.id } : {}),
          ...(tab === "saved" ? { saved_only: "true" } : {}),
          ...(category !== "All" ? { category: category.toLowerCase() } : {}),
          ...(search ? { search } : {}),
          ...(minPrice ? { min_price: minPrice } : {}),
          ...(maxPrice ? { max_price: maxPrice } : {}),
          sort,
        },
      }),
  });

  const listings = data?.items || [];

  const saveMutation = useMutation({
    mutationFn: ({ id, isSaved }: { id: string; isSaved: boolean }) =>
      isSaved
        ? api.delete(`/marketplace/listings/${id}/save`)
        : api.post(`/marketplace/listings/${id}/save`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["listings"] });
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

  const renderItem = useCallback(({ item }: { item: Listing }) => {
    const firstImage = item.images && item.images.length > 0 ? item.images[0].url : null;
    const condition = item.condition ? CONDITION_MAP[item.condition] : null;
    const hasVideo = item.images?.some((img) => img.media_type === "video");
    const imageCount = item.images?.filter((img) => img.media_type === "image").length || 0;
    const videoCount = item.images?.filter((img) => img.media_type === "video").length || 0;

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => router.push(`/marketplace/${item.id}`)}
        activeOpacity={0.7}
      >
        {/* Image */}
        <View style={[styles.imageContainer, { backgroundColor: colors.muted }]}>
          {firstImage ? (
            <Image source={{ uri: firstImage }} style={styles.cardImage} resizeMode="cover" />
          ) : (
            <Ionicons name="image-outline" size={28} color={colors.textTertiary} />
          )}
          {/* Image/video count indicator */}
          {item.images && item.images.length > 1 && (
            <View style={[styles.imageCount, { backgroundColor: "rgba(0,0,0,0.6)" }]}>
              {hasVideo ? (
                <Ionicons name="videocam" size={10} color="#fff" />
              ) : (
                <Ionicons name="images-outline" size={10} color="#fff" />
              )}
              <Text style={styles.imageCountText}>{item.images.length}</Text>
            </View>
          )}
          {/* Save button */}
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={(e) => {
              e.stopPropagation();
              saveMutation.mutate({ id: item.id, isSaved: item.is_saved });
            }}
          >
            <Ionicons
              name={item.is_saved ? "bookmark" : "bookmark-outline"}
              size={16}
              color={item.is_saved ? colors.primary : "#fff"}
            />
          </TouchableOpacity>
          {/* Condition badge */}
          {condition && (
            <View style={[styles.conditionBadge, { backgroundColor: condition.color }]}>
              <Text style={styles.conditionBadgeText}>{condition.label}</Text>
            </View>
          )}
        </View>

        <View style={styles.cardContent}>
          {/* Price */}
          <Text style={[styles.price, { color: colors.primary }]}>₹{item.price.toFixed(0)}</Text>
          {/* Title */}
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={2}>{item.title}</Text>
          {/* Rating */}
          {item.rating_count != null && item.rating_count > 0 && (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={12} color="#f59e0b" />
              <Text style={[styles.ratingText, { color: colors.textSecondary }]}>
                {item.avg_rating?.toFixed(1)} ({item.rating_count})
              </Text>
            </View>
          )}
          {/* Meta row */}
          <View style={styles.cardMeta}>
            {item.location && (
              <View style={styles.metaItem}>
                <Ionicons name="location-outline" size={10} color={colors.textSecondary} />
                <Text style={[styles.metaText, { color: colors.textSecondary }]} numberOfLines={1}>{item.location}</Text>
              </View>
            )}
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={10} color={colors.textSecondary} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>{getRelativeTime(item.created_at)}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [colors, saveMutation]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Marketplace</Text>
        {isAdmin && (
          <TouchableOpacity onPress={() => router.push("/marketplace/create")}>
            <Ionicons name="add-circle" size={24} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
        {[
          { key: "browse" as Tab, label: "Browse" },
          ...(isAdmin ? [
            { key: "my" as Tab, label: "My Listings" },
            { key: "saved" as Tab, label: "Saved" },
          ] : []),
        ].map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && { borderBottomColor: colors.primary }]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabText, { color: tab === t.key ? colors.primary : colors.textSecondary }]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search + Sort row */}
      <View style={[styles.searchRow, { borderBottomColor: colors.border }]}>
        <View style={[styles.searchInput, { borderColor: colors.border, backgroundColor: colors.muted + "30" }]}>
          <Ionicons name="search" size={16} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchText, { color: colors.textPrimary }]}
            placeholder="Search listings..."
            placeholderTextColor={colors.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.sortBtn, { borderColor: colors.border, backgroundColor: colors.muted + "30" }]}
          onPress={() => setShowSort(!showSort)}
        >
          <Ionicons name="swap-vertical" size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Sort dropdown */}
      {showSort && (
        <View style={[styles.sortDropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {SORT_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.sortOption, sort === opt.value && { backgroundColor: colors.primary + "10" }]}
              onPress={() => { setSort(opt.value); setShowSort(false); }}
            >
              <Ionicons name={opt.icon} size={16} color={sort === opt.value ? colors.primary : colors.textSecondary} />
              <Text style={[styles.sortOptionText, { color: sort === opt.value ? colors.primary : colors.textPrimary }]}>
                {opt.label}
              </Text>
              {sort === opt.value && <Ionicons name="checkmark" size={16} color={colors.primary} />}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Price filter */}
      {tab === "browse" && (
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterChip, { borderColor: showPriceFilter ? colors.primary : colors.border }]}
            onPress={() => setShowPriceFilter(!showPriceFilter)}
          >
            <Ionicons name="pricetag-outline" size={12} color={showPriceFilter ? colors.primary : colors.textSecondary} />
            <Text style={[styles.filterChipText, { color: showPriceFilter ? colors.primary : colors.textSecondary }]}>
              Price{(minPrice || maxPrice) ? `: ₹${minPrice || "0"}–₹${maxPrice || "∞"}` : ""}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Price range inputs */}
      {showPriceFilter && tab === "browse" && (
        <View style={[styles.priceRange, { backgroundColor: colors.muted + "20" }]}>
          <View style={[styles.priceInputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <Text style={[styles.priceInputLabel, { color: colors.textSecondary }]}>₹</Text>
            <TextInput
              style={[styles.priceInput, { color: colors.textPrimary }]}
              placeholder="Min"
              placeholderTextColor={colors.mutedForeground}
              value={minPrice}
              onChangeText={setMinPrice}
              keyboardType="numeric"
            />
          </View>
          <Text style={[styles.priceDash, { color: colors.textSecondary }]}>—</Text>
          <View style={[styles.priceInputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <Text style={[styles.priceInputLabel, { color: colors.textSecondary }]}>₹</Text>
            <TextInput
              style={[styles.priceInput, { color: colors.textPrimary }]}
              placeholder="Max"
              placeholderTextColor={colors.mutedForeground}
              value={maxPrice}
              onChangeText={setMaxPrice}
              keyboardType="numeric"
            />
          </View>
          {(minPrice || maxPrice) && (
            <TouchableOpacity onPress={() => { setMinPrice(""); setMaxPrice(""); }}>
              <Ionicons name="close-circle" size={20} color={colors.destructive} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Categories */}
      {tab === "browse" && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categories} contentContainerStyle={styles.categoriesContent}>
          {CATEGORIES.map((c) => (
            <TouchableOpacity
              key={c.label}
              style={[
                styles.categoryChip,
                {
                  backgroundColor: category === c.label ? colors.primary : "transparent",
                  borderColor: category === c.label ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setCategory(c.label)}
            >
              <Ionicons
                name={c.icon}
                size={12}
                color={category === c.label ? colors.primaryForeground : colors.textSecondary}
              />
              <Text
                style={[
                  styles.categoryText,
                  { color: category === c.label ? colors.primaryForeground : colors.textSecondary },
                ]}
              >
                {c.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Listings grid */}
      <FlatList
        data={listings}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        numColumns={2}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        contentContainerStyle={[styles.list]}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="pricetag-outline" size={40} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {tab === "my" ? "No listings yet" : tab === "saved" ? "No saved listings" : "No listings found"}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 18, fontWeight: "700" },
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
  tabText: { fontSize: 13, fontWeight: "600" },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchInput: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 36,
    gap: 6,
  },
  searchText: { flex: 1, fontSize: 13 },
  sortBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sortDropdown: {
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
  },
  sortOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sortOptionText: { flex: 1, fontSize: 13, fontWeight: "500" },
  filterRow: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  filterChipText: { fontSize: 12, fontWeight: "500" },
  priceRange: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 10,
    borderRadius: 10,
    gap: 8,
  },
  priceInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    height: 34,
  },
  priceInputLabel: { fontSize: 12, fontWeight: "500", marginRight: 4 },
  priceInput: { flex: 1, fontSize: 12, height: 34 },
  priceDash: { fontSize: 14, fontWeight: "500" },
  categories: {
    flexGrow: 0,
  },
  categoriesContent: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 6,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 80,
    justifyContent: "center",
  },
  categoryText: { fontSize: 11, fontWeight: "500" },
  list: { padding: 6 },
  card: {
    flex: 1,
    margin: 6,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  imageContainer: {
    height: 130,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  imageCount: {
    position: "absolute",
    bottom: 6,
    right: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  imageCountText: { color: "#fff", fontSize: 10, fontWeight: "600" },
  saveBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  conditionBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  conditionBadgeText: { color: "#fff", fontSize: 9, fontWeight: "700", textTransform: "uppercase" },
  cardContent: { padding: 10 },
  price: { fontSize: 16, fontWeight: "800", marginBottom: 2 },
  cardTitle: { fontSize: 12, fontWeight: "500", marginBottom: 6, lineHeight: 16 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 3, marginBottom: 4 },
  ratingText: { fontSize: 11, fontWeight: "500" },
  cardMeta: { flexDirection: "row", gap: 8 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 2 },
  metaText: { fontSize: 10 },
  empty: {
    alignItems: "center",
    paddingVertical: 80,
    gap: 12,
  },
  emptyText: { fontSize: 14 },
});
