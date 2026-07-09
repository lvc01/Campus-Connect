import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  Share,
  Linking,
  Image,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api-client";
import { useTheme } from "../../lib/theme-context";
import { useAuth } from "../../hooks/useAuth";
import { Avatar } from "../../components/Avatar";
import { MediaGallery } from "../../components/MediaGallery";
import { ReportSheet } from "../../components/ReportSheet";
import { Ionicons } from "@expo/vector-icons";
import { spacing, fontSize, borderRadius } from "../../lib/theme";
import type { Listing } from "../../types";

function getRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const CONDITION_MAP: Record<string, { color: string; label: string }> = {
  new: { color: "#22c55e", label: "New" },
  like_new: { color: "#38bdf8", label: "Like New" },
  good: { color: "#f59e0b", label: "Good" },
  fair: { color: "#f97316", label: "Fair" },
  used: { color: "#6b7280", label: "Used" },
};

const CATEGORY_ICONS: Record<string, string> = {
  textbooks: "book-outline",
  electronics: "hardware-chip-outline",
  accommodation: "home-outline",
  tutoring: "school-outline",
  other: "ellipsis-horizontal-outline",
};

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [reportOpen, setReportOpen] = useState(false);

  const { data: listing } = useQuery({
    queryKey: ["listing", id],
    queryFn: () => api.get<Listing>(`/marketplace/listings/${id}`),
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      listing?.is_saved
        ? api.delete(`/marketplace/listings/${id}/save`)
        : api.post(`/marketplace/listings/${id}/save`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      queryClient.invalidateQueries({ queryKey: ["listing", id] });
    },
  });

  const createConversationMutation = useMutation({
    mutationFn: (sellerId: string) =>
      api.post<{ id: string }>("/messaging/conversations", {
        type: "direct",
        member_ids: [sellerId],
      }),
    onSuccess: (data) => {
      router.push(`/(tabs)/messages/${data.id}`);
    },
    onError: () => {
      Alert.alert("Error", "Could not start conversation. Please try again.");
    },
  });

  if (!listing) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loading}>
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isOwner = user?.id === listing.seller.id;
  const images = listing.images || [];
  const condition = listing.condition ? CONDITION_MAP[listing.condition] : null;
  const categoryIcon = CATEGORY_ICONS[listing.category] || "pricetag-outline";

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView>
        {/* Image gallery */}
        {images.length > 0 ? (
          <MediaGallery media={images.map((img) => ({ url: img.url, media_type: img.media_type }))} />
        ) : (
          <View style={[styles.placeholderImage, { backgroundColor: colors.muted }]}>
            <Ionicons name="image-outline" size={48} color={colors.textTertiary} />
          </View>
        )}

        {/* Header overlay */}
        <View style={styles.headerOverlay}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setReportOpen(true)}>
            <Ionicons name="flag-outline" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {/* Title + Price */}
          <View style={styles.titleRow}>
            <Text style={[styles.listingTitle, { color: colors.textPrimary }]}>{listing.title}</Text>
          </View>
          <Text style={[styles.price, { color: colors.primary }]}>₹{listing.price.toFixed(2)}</Text>

          {/* Info rows */}
          {/* Category */}
          <View style={styles.infoRow}>
            <View style={[styles.infoIcon, { backgroundColor: colors.primary + "15" }]}>
              <Ionicons name={categoryIcon as any} size={18} color={colors.primary} />
            </View>
            <View style={styles.infoContent}>
              <Text style={[styles.infoTitle, { color: colors.textPrimary }]}>{listing.category}</Text>
              <Text style={[styles.infoSubtitle, { color: colors.textSecondary }]}>Category</Text>
            </View>
          </View>

          {/* Condition */}
          {condition && (
            <View style={styles.infoRow}>
              <View style={[styles.infoIcon, { backgroundColor: condition.color + "15" }]}>
                <Ionicons name="information-circle-outline" size={18} color={condition.color} />
              </View>
              <View style={styles.infoContent}>
                <Text style={[styles.infoTitle, { color: condition.color }]}>{condition.label}</Text>
                <Text style={[styles.infoSubtitle, { color: colors.textSecondary }]}>Condition</Text>
              </View>
            </View>
          )}

          {/* Location */}
          {listing.location && (
            <TouchableOpacity
              style={styles.infoRow}
              onPress={() => {
                const query = encodeURIComponent(listing.location!);
                const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
                Linking.canOpenURL(url).then((supported) =>
                  Linking.openURL(supported ? url : `https://maps.google.com/?q=${query}`)
                );
              }}
            >
              <View style={[styles.infoIcon, { backgroundColor: colors.primary + "15" }]}>
                <Ionicons name="location-outline" size={18} color={colors.primary} />
              </View>
              <View style={styles.infoContent}>
                <Text style={[styles.infoTitle, { color: colors.primary }]}>{listing.location}</Text>
                <Text style={[styles.infoSubtitle, { color: colors.primary }]}>Open in Maps</Text>
              </View>
              <Ionicons name="open-outline" size={14} color={colors.primary} />
            </TouchableOpacity>
          )}

          {/* Stats */}
          <View style={styles.statsRow}>
            {listing.view_count != null && (
              <View style={[styles.statChip, { backgroundColor: colors.muted + "40" }]}>
                <Ionicons name="eye-outline" size={13} color={colors.textSecondary} />
                <Text style={[styles.statText, { color: colors.textSecondary }]}>{listing.view_count} views</Text>
              </View>
            )}
            {listing.rating_count != null && listing.rating_count > 0 && (
              <View style={[styles.statChip, { backgroundColor: colors.muted + "40" }]}>
                <Ionicons name="star" size={13} color={colors.warning} />
                <Text style={[styles.statText, { color: colors.textSecondary }]}>
                  {listing.avg_rating?.toFixed(1)} ({listing.rating_count})
                </Text>
              </View>
            )}
            {images.length > 0 && (
              <View style={[styles.statChip, { backgroundColor: colors.muted + "40" }]}>
                <Ionicons name="images-outline" size={13} color={colors.textSecondary} />
                <Text style={[styles.statText, { color: colors.textSecondary }]}>{images.length} photos</Text>
              </View>
            )}
            {images.some((img) => img.media_type === "video") && (
              <View style={[styles.statChip, { backgroundColor: colors.muted + "40" }]}>
                <Ionicons name="videocam-outline" size={13} color={colors.textSecondary} />
                <Text style={[styles.statText, { color: colors.textSecondary }]}>
                  {images.filter((img) => img.media_type === "video").length} videos
                </Text>
              </View>
            )}
            <View style={[styles.statChip, { backgroundColor: colors.muted + "40" }]}>
              <Ionicons name="time-outline" size={13} color={colors.textSecondary} />
              <Text style={[styles.statText, { color: colors.textSecondary }]}>{getRelativeTime(listing.created_at)}</Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Description */}
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Description</Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            {listing.description || "No description provided."}
          </Text>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Seller */}
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Seller</Text>
          <TouchableOpacity
            style={[styles.sellerRow, { backgroundColor: colors.muted + "20" }]}
            onPress={() => router.push(`/profile/${listing.seller.id}`)}
          >
            <Avatar uri={listing.seller.avatar_url} name={listing.seller.display_name} size="md" />
            <View style={styles.sellerInfo}>
              <Text style={[styles.sellerName, { color: colors.textPrimary }]}>{listing.seller.display_name}</Text>
              {listing.seller.username ? (
                <Text style={[styles.sellerHandle, { color: colors.textSecondary }]}>@{listing.seller.username}</Text>
              ) : (
                <Text style={[styles.sellerHandle, { color: colors.textSecondary }]}>{listing.seller.email}</Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bottom bar */}
      {!isOwner ? (
        <View style={[styles.bottomBar, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.iconBtn, { borderColor: colors.border }]}
            onPress={() => saveMutation.mutate()}
          >
            <Ionicons
              name={listing.is_saved ? "bookmark" : "bookmark-outline"}
              size={20}
              color={listing.is_saved ? colors.primary : colors.textSecondary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, { borderColor: colors.border }]}
            onPress={() => {
              Share.share({ message: `${listing.title} — ₹${listing.price.toFixed(2)} on Campus Connect` }).catch(() => {});
            }}
          >
            <Ionicons name="share-outline" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.messageBtn, { backgroundColor: colors.primary }]}
            onPress={() => {
              if (listing?.seller?.id) {
                createConversationMutation.mutate(listing.seller.id);
              }
            }}
            disabled={createConversationMutation.isPending}
          >
            <Ionicons name="chatbubble-outline" size={18} color="#fff" />
            <Text style={styles.messageBtnText}>
              {createConversationMutation.isPending ? "Starting..." : "Message Seller"}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.bottomBar, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.iconBtn, { borderColor: colors.border }]}
            onPress={() => Share.share({ message: `${listing.title} — ₹${listing.price.toFixed(2)} on Campus Connect` }).catch(() => {})}
          >
            <Ionicons name="share-outline" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.editBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push(`/marketplace/create?edit=${listing.id}`)}
          >
            <Ionicons name="pencil-outline" size={18} color="#fff" />
            <Text style={styles.editBtnText}>Edit Listing</Text>
          </TouchableOpacity>
        </View>
      )}

      <ReportSheet
        open={reportOpen}
        targetType="listing"
        targetId={id}
        onClose={() => setReportOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { fontSize: 15 },
  placeholderImage: {
    width: "100%",
    height: 220,
    alignItems: "center",
    justifyContent: "center",
  },
  headerOverlay: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  content: { padding: 16 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 4 },
  listingTitle: { fontSize: 22, fontWeight: "700", flex: 1 },
  price: { fontSize: 24, fontWeight: "800", marginBottom: 16 },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  infoContent: { flex: 1 },
  infoTitle: { fontSize: 14, fontWeight: "500" },
  infoSubtitle: { fontSize: 12, marginTop: 1 },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 16,
  },
  statChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statText: { fontSize: 12 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 16 },
  sectionTitle: { fontSize: 16, fontWeight: "600", marginBottom: 8 },
  description: { fontSize: 15, lineHeight: 22 },
  sellerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
  },
  sellerInfo: { flex: 1 },
  sellerName: { fontSize: 15, fontWeight: "600" },
  sellerHandle: { fontSize: 13, marginTop: 1 },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  messageBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 44,
    borderRadius: 12,
  },
  messageBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  editBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 44,
    borderRadius: 12,
  },
  editBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
