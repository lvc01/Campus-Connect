import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Image,
  Linking,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { api } from "../../lib/api-client";
import { useTheme } from "../../lib/theme-context";
import { useAuth } from "../../hooks/useAuth";
import { Avatar } from "../../components/Avatar";
import { PostCard } from "../../components/PostCard";
import { Ionicons } from "@expo/vector-icons";
import type { User, Post } from "../../types";

type TabType = "posts" | "replies" | "media" | "likes" | "reposts";

const tabs: { key: TabType; label: string }[] = [
  { key: "posts", label: "Posts" },
  { key: "replies", label: "Replies" },
  { key: "media", label: "Media" },
  { key: "reposts", label: "Reposts" },
  { key: "likes", label: "Likes" },
];

const ROLE_BADGES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  admin: { bg: "#f59e0b15", text: "#f59e0b", border: "#f59e0b30", label: "Admin" },
  moderator: { bg: "#0ea5e915", text: "#0ea5e9", border: "#0ea5e930", label: "Moderator" },
  university_staff: { bg: "#8b5cf615", text: "#8b5cf6", border: "#8b5cf630", label: "Staff" },
};

const ROLE_ICONS: Record<string, { name: string; color: string }> = {
  admin: { name: "checkmark-circle", color: "#0ea5e9" },
  moderator: { name: "shield", color: "#8b5cf6" },
  student: { name: "book", color: "#6b7280" },
  university_staff: { name: "school", color: "#f59e0b" },
};

function getJoinedDate(dateString: string): string {
  const d = new Date(dateString);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export default function ProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [showMenu, setShowMenu] = useState(false);
  const [showUnblockDialog, setShowUnblockDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("posts");

  const { data: user, refetch, isRefetching } = useQuery({
    queryKey: ["profile", id],
    queryFn: () => api.get<User & { posts_count?: number; clubs_count?: number; events_count?: number; listings_count?: number }>(`/users/${id}/profile`),
    enabled: !!id,
  });

  const { data: blocksData } = useQuery({
    queryKey: ["user-blocks"],
    queryFn: () => api.get<{ items: { blocked_user_id: string }[] }>("/users/me/blocks"),
  });

  const isBlocked = blocksData?.items?.some((b) => b.blocked_user_id === id) ?? false;

  const { data: tabData, isLoading: tabLoading } = useQuery({
    queryKey: ["profile-tab", id, activeTab],
    queryFn: () => api.get<{ items: Post[] }>(`/users/${id}/${activeTab}`),
    enabled: !!id && !isBlocked,
  });

  const blockMutation = useMutation({
    mutationFn: () => api.post(`/users/${id}/block`),
    onSuccess: () => {
      setShowMenu(false);
      queryClient.invalidateQueries({ queryKey: ["profile", id] });
      queryClient.invalidateQueries({ queryKey: ["user-blocks"] });
    },
  });

  const unblockMutation = useMutation({
    mutationFn: () => api.delete(`/users/${id}/block`),
    onSuccess: () => {
      setShowUnblockDialog(false);
      queryClient.invalidateQueries({ queryKey: ["profile", id] });
      queryClient.invalidateQueries({ queryKey: ["user-blocks"] });
    },
  });

  const reportMutation = useMutation({
    mutationFn: () => api.post("/reports", { target_type: "user", target_id: id }),
    onSuccess: () => setShowMenu(false),
  });

  const tabItems = tabData?.items || [];
  const isOwnProfile = currentUser?.id === id;
  const handle = user?.username || user?.email?.split("@")[0] || "";

  if (!user) return null;

  const roleBadge = user.role !== "student" ? ROLE_BADGES[user.role] : null;
  const profile = user.profile;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerName, { color: colors.textPrimary }]} numberOfLines={1}>
            {profile?.display_name || user.email}
          </Text>
        </View>
        <TouchableOpacity onPress={() => setShowMenu(true)}>
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Cover */}
        <View style={[styles.cover, { backgroundColor: colors.muted }]}>
          {profile?.cover_url ? (
            <Image source={{ uri: profile.cover_url }} style={styles.coverImage} />
          ) : (
            <View style={[styles.coverGradient, { backgroundColor: colors.primary + "15" }]} />
          )}
        </View>

        {/* Profile card */}
        <View style={[styles.profileCard, { backgroundColor: colors.background }]}>
          {/* Avatar overlapping cover */}
          <View style={styles.avatarRow}>
            <View style={[styles.avatarWrap, { borderColor: colors.background }]}>
              <Avatar uri={profile?.avatar_url} name={profile?.display_name || user.email} size="xl" />
            </View>
            {isOwnProfile ? (
              <TouchableOpacity
                style={[styles.editBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
                onPress={() => router.push("/profile/edit")}
              >
                <Text style={[styles.editBtnText, { color: colors.textPrimary }]}>Edit profile</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.headerActions}>
                <TouchableOpacity onPress={() => setShowMenu(true)}>
                  <Ionicons name="ellipsis-horizontal" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Name + role badge */}
          <View style={styles.nameRow}>
            <Text style={[styles.displayName, { color: colors.textPrimary }]} numberOfLines={1}>
              {profile?.display_name || user.email}
            </Text>
            {ROLE_ICONS[user.role] && (
              <Ionicons name={ROLE_ICONS[user.role].name as any} size={16} color={ROLE_ICONS[user.role].color} />
            )}
            {user.username && (
              <Text style={{ color: colors.textTertiary, fontSize: 14, marginLeft: 4 }}>
                @{user.username}
              </Text>
            )}
          </View>

          {/* Meta */}
          <View style={styles.metaRow}>
            {(profile?.faculty || profile?.year_of_study) && (
              <View style={styles.metaItem}>
                <Ionicons name="school-outline" size={14} color={colors.textSecondary} />
                <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                  {[profile?.faculty, profile?.year_of_study ? `Year ${profile.year_of_study}` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>
            )}
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                Joined {getJoinedDate(user.created_at)}
              </Text>
            </View>
          </View>

          {/* Bio */}
          {profile?.bio && (
            <Text style={[styles.bio, { color: colors.textPrimary }]}>{profile.bio}</Text>
          )}

          {/* Social links */}
          {profile?.social_links && Object.keys(profile.social_links).length > 0 && (
            <View style={styles.socialLinks}>
              {Object.entries(profile.social_links).map(([platform, url]) => {
                const iconName = platform === "github" ? "logo-github"
                  : platform === "linkedin" ? "logo-linkedin"
                  : platform === "twitter" ? "logo-x"
                  : platform === "instagram" ? "logo-instagram"
                  : platform === "youtube" ? "logo-youtube"
                  : platform === "whatsapp" ? "logo-whatsapp"
                  : "link-outline";
                const label = platform === "twitter" ? "X" : platform.charAt(0).toUpperCase() + platform.slice(1);
                return (
                  <TouchableOpacity key={platform} style={[styles.socialLink, { borderColor: colors.border }]} onPress={() => {
                    const urlStr = url as string;
                    if (platform === "whatsapp" && !urlStr.startsWith("http")) {
                      Linking.openURL(`https://wa.me/${urlStr.replace(/[^0-9]/g, "")}`);
                    } else {
                      Linking.openURL(urlStr);
                    }
                  }}>
                    <Ionicons name={iconName as any} size={14} color={colors.primary} />
                    <Text style={[styles.socialLinkText, { color: colors.primary }]} numberOfLines={1}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Stats grid */}
          <View style={[styles.statsGrid, { borderTopColor: colors.border }]}>
            {[
              { label: "POSTS", value: (user as any).posts_count || 0 },
              { label: "CLUBS", value: (user as any).clubs_count || 0 },
              { label: "EVENTS", value: (user as any).events_count || 0 },
              { label: "LISTINGS", value: (user as any).listings_count || 0 },
            ].map((stat) => (
              <View key={stat.label} style={styles.statCard}>
                <Text style={[styles.statValue, { color: colors.textPrimary }]}>{stat.value}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{stat.label}</Text>
              </View>
            ))}
          </View>

          {/* Action buttons */}
          {!isOwnProfile && (
            <View style={styles.actions}>
              {isBlocked ? (
                <>
                  <View style={[styles.blockedBadge, { backgroundColor: colors.error + "15" }]}>
                    <Ionicons name="ban" size={16} color={colors.error} />
                    <Text style={[styles.blockedBadgeText, { color: colors.error }]}>Blocked</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.actionBtn, { borderColor: colors.error }]}
                    onPress={() => setShowUnblockDialog(true)}
                  >
                    <Text style={[styles.actionBtnText, { color: colors.error }]}>Unblock</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.actionBtn, { borderColor: colors.border }]}
                    onPress={() => router.push(`/(tabs)/messages/${user.id}`)}
                  >
                    <Ionicons name="chatbubble-outline" size={16} color={colors.textPrimary} />
                    <Text style={[styles.actionBtnText, { color: colors.textPrimary }]}>Message</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
        </View>

        {/* Tabs */}
        {!isBlocked && (
          <View style={[styles.tabsContainer, { borderTopColor: colors.border }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
              {tabs.map((tab) => (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.tab, activeTab === tab.key && { borderBottomColor: colors.primary }]}
                  onPress={() => setActiveTab(tab.key)}
                >
                  <Text
                    style={[
                      styles.tabText,
                      {
                        color: activeTab === tab.key ? colors.primary : colors.textSecondary,
                        fontWeight: activeTab === tab.key ? "600" : "400",
                      },
                    ]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Tab content */}
        {!isBlocked && (
          <View style={styles.tabContent}>
            {tabLoading ? (
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading...</Text>
            ) : tabItems.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No {activeTab} yet
              </Text>
            ) : (
              tabItems.map((item) => <PostCard key={item.id} post={item} />)
            )}
          </View>
        )}
      </ScrollView>

      {/* Unblock dialog */}
      <Modal visible={showUnblockDialog} transparent animationType="fade" onRequestClose={() => setShowUnblockDialog(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowUnblockDialog(false)}>
          <TouchableOpacity
            style={[styles.dialogContainer, { backgroundColor: colors.card }]}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.dialogTitle, { color: colors.textPrimary }]}>Unblock User</Text>
            <Text style={[styles.dialogDescription, { color: colors.textSecondary }]}>
              Are you sure you want to unblock @{handle}? They will be able to see your posts and interact with you again.
            </Text>
            <View style={styles.dialogActions}>
              <TouchableOpacity style={[styles.dialogBtn, { borderColor: colors.border }]} onPress={() => setShowUnblockDialog(false)}>
                <Text style={[styles.dialogBtnText, { color: colors.textPrimary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.dialogBtn, { backgroundColor: colors.error }]} onPress={() => unblockMutation.mutate()}>
                <Text style={[styles.dialogBtnText, { color: "#fff" }]}>Unblock</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Profile menu */}
      <Modal visible={showMenu} transparent animationType="slide" onRequestClose={() => setShowMenu(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowMenu(false)}>
          <View style={[styles.menuModal, { backgroundColor: colors.card }]}>
            {!isOwnProfile && (
              <>
                <TouchableOpacity
                  style={[styles.menuItem, { borderBottomColor: colors.border }]}
                  onPress={() => { setShowMenu(false); reportMutation.mutate(); }}
                >
                  <Ionicons name="flag-outline" size={20} color={colors.warning} />
                  <Text style={[styles.menuText, { color: colors.warning }]}>Report user</Text>
                </TouchableOpacity>
                {!isBlocked && (
                  <TouchableOpacity
                    style={[styles.menuItem, { borderBottomColor: colors.border }]}
                    onPress={() => { setShowMenu(false); blockMutation.mutate(); }}
                  >
                    <Ionicons name="ban-outline" size={20} color={colors.error} />
                    <Text style={[styles.menuText, { color: colors.error }]}>Block user</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
            <TouchableOpacity style={styles.menuItem} onPress={() => setShowMenu(false)}>
              <Ionicons name="close-outline" size={20} color={colors.textSecondary} />
              <Text style={[styles.menuText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
  headerCenter: { flex: 1, marginHorizontal: 16 },
  headerName: { fontSize: 17, fontWeight: "600" },
  scrollContent: { paddingBottom: 40 },

  // Cover
  cover: { height: 130 },
  coverImage: { width: "100%", height: "100%" },
  coverGradient: { flex: 1 },

  // Profile card
  profileCard: { paddingHorizontal: 16, paddingBottom: 16 },

  // Avatar row
  avatarRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: -40,
    marginBottom: 12,
  },
  avatarWrap: {
    borderWidth: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  headerActions: { paddingBottom: 8 },
  editBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  editBtnText: { fontSize: 14, fontWeight: "600" },

  // Name
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  displayName: { fontSize: 22, fontWeight: "700" },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  roleBadgeText: { fontSize: 11, fontWeight: "600" },
  handle: { fontSize: 15, marginBottom: 10 },

  // Meta
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 10 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 14 },

  // Bio
  bio: { fontSize: 15, lineHeight: 22, marginBottom: 12 },

  // Social
  socialLinks: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  socialLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  socialLinkText: { fontSize: 13 },

  // Stats grid
  statsGrid: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 14,
    gap: 4,
  },
  statCard: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 18, fontWeight: "700" },
  statLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 0.5, marginTop: 2 },

  // Actions
  actions: { flexDirection: "row", gap: 10, marginTop: 14 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionBtnText: { fontSize: 14, fontWeight: "600" },
  blockedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  blockedBadgeText: { fontSize: 14, fontWeight: "600" },

  // Tabs
  tabsContainer: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 4 },
  tabsScroll: { flexDirection: "row" },
  tab: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabText: { fontSize: 14 },

  // Tab content
  tabContent: {},
  loadingText: { fontSize: 15, textAlign: "center", paddingVertical: 40 },
  emptyText: { fontSize: 15, textAlign: "center", paddingVertical: 40 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  menuModal: { borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 32 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 14,
  },
  menuText: { fontSize: 16 },
  dialogContainer: { margin: 20, borderRadius: 16, padding: 24 },
  dialogTitle: { fontSize: 18, fontWeight: "600", marginBottom: 8 },
  dialogDescription: { fontSize: 14, lineHeight: 20, marginBottom: 20 },
  dialogActions: { flexDirection: "row", gap: 10 },
  dialogBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  dialogBtnText: { fontSize: 15, fontWeight: "600" },
});
