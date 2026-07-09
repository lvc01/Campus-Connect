import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  RefreshControl,
  Share,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api-client";
import { useTheme } from "../../lib/theme-context";
import { Avatar } from "../../components/Avatar";
import { PostCard } from "../../components/PostCard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/Tabs";
import { ReportSheet } from "../../components/ReportSheet";
import { Ionicons } from "@expo/vector-icons";
import { spacing, fontSize, borderRadius } from "../../lib/theme";
import type { Club, Post, Event } from "../../types";

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

interface ClubDetail extends Club {
  banner_url: string | null;
  owner_id: string;
}

interface ClubMember {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  role: "owner" | "admin" | "member";
  status: "pending" | "approved" | "rejected";
  joined_at: string;
  user_id: string;
}

function getRoleColor(role: string, colors: ReturnType<typeof useTheme>["colors"]): string {
  switch (role) {
    case "owner":
      return colors.warning;
    case "admin":
      return colors.primary;
    default:
      return colors.textSecondary;
  }
}

export default function ClubDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [reportOpen, setReportOpen] = useState(false);

  const { data: club, isLoading: clubLoading } = useQuery({
    queryKey: ["club", id],
    queryFn: () => api.get<ClubDetail>(`/clubs/${id}`),
  });

  const clubId = club?.id;

  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: ["club-members", clubId],
    queryFn: () => api.get<{ items: ClubMember[] }>(`/clubs/${clubId}/members`),
    enabled: !!clubId,
  });

  const { data: postsData, isLoading: postsLoading } = useQuery({
    queryKey: ["club-posts", clubId],
    queryFn: () =>
      api.get<{ items: Post[] }>("/posts", { params: { club_id: clubId!, club_feed: "true" } }),
    enabled: !!clubId,
  });

  const { data: clubEvents, isLoading: eventsLoading } = useQuery({
    queryKey: ["club-events", clubId],
    queryFn: () => api.get<Event[]>("/events", { params: { club_id: clubId!, upcoming: "true" } }),
    enabled: !!clubId,
  });

  const { data: pendingData, isLoading: pendingLoading } = useQuery({
    queryKey: ["club-pending", clubId],
    queryFn: () => api.get<{ items: ClubMember[] }>(`/clubs/${clubId}/members/pending`),
    enabled: !!clubId,
  });

  const approveMutation = useMutation({
    mutationFn: (userId: string) => api.post(`/clubs/${clubId}/members/${userId}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["club", id] });
      queryClient.invalidateQueries({ queryKey: ["club-members", clubId] });
      queryClient.invalidateQueries({ queryKey: ["club-pending", clubId] });
    },
    onError: (error: Error) => Alert.alert("Error", error.message),
  });

  const rejectMutation = useMutation({
    mutationFn: (userId: string) => api.post(`/clubs/${clubId}/members/${userId}/reject`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["club", id] });
      queryClient.invalidateQueries({ queryKey: ["club-pending", clubId] });
    },
    onError: (error: Error) => Alert.alert("Error", error.message),
  });

  const joinMutation = useMutation({
    mutationFn: () => api.post(`/clubs/${clubId}/join`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["club", id] });
      queryClient.invalidateQueries({ queryKey: ["club-members", clubId] });
    },
    onError: (error: Error) => Alert.alert("Error", error.message),
  });

  const leaveMutation = useMutation({
    mutationFn: () => api.delete(`/clubs/${clubId}/join`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["club", id] });
      queryClient.invalidateQueries({ queryKey: ["club-members", clubId] });
    },
    onError: (error: Error) => Alert.alert("Error", error.message),
  });

  const handleJoinLeave = () => {
    if (!club) return;
    if (club.is_member) {
      Alert.alert("Leave Club", `Are you sure you want to leave ${club.name}?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Leave", style: "destructive", onPress: () => leaveMutation.mutate() },
      ]);
    } else if (club.is_pending) {
      Alert.alert("Request Pending", "Your join request is awaiting approval.");
    } else {
      joinMutation.mutate();
    }
  };

  const members = membersData?.items || [];
  const posts = postsData?.items || [];
  const pendingMembers = pendingData?.items || [];

  if (clubLoading || !club) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loading}>
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isOwnerOrAdmin = club.member_role === "owner" || club.member_role === "admin";

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => {
              queryClient.invalidateQueries({ queryKey: ["club", id] });
              queryClient.invalidateQueries({ queryKey: ["club-members", clubId] });
              queryClient.invalidateQueries({ queryKey: ["club-posts", clubId] });
              queryClient.invalidateQueries({ queryKey: ["club-events", clubId] });
            }}
          />
        }
      >
        {/* Banner */}
        {club.banner_url ? (
          <Image source={{ uri: club.banner_url }} style={styles.banner} resizeMode="cover" />
        ) : (
          <View style={[styles.bannerPlaceholder, { backgroundColor: colors.primary + "10" }]}>
            <Ionicons name="people" size={40} color={colors.primary + "30"} />
          </View>
        )}

        {/* Header overlay */}
        <View style={styles.headerOverlay}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Share.share({ message: `${club.name} — Campus Connect` }).catch(() => {})}>
            <Ionicons name="share-outline" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {/* Avatar + Name */}
          <View style={styles.nameRow}>
            <View style={[styles.avatarContainer, { borderColor: colors.background }]}>
              <Avatar uri={club.logo_url || club.avatar_url} name={club.name} size="lg" />
            </View>
            <View style={styles.nameText}>
              <View style={styles.nameLine}>
                <Text style={[styles.clubName, { color: colors.textPrimary }]} numberOfLines={1}>{club.name}</Text>
                {club.is_verified && (
                  <Ionicons name="checkmark-circle" size={16} color="#38bdf8" />
                )}
              </View>
              <Text style={[styles.categoryText, { color: colors.textSecondary }]}>
                {CATEGORY_MAP[club.category] || club.category}
              </Text>
            </View>
          </View>

          {/* Members */}
          <View style={styles.infoRow}>
            <View style={[styles.infoIcon, { backgroundColor: colors.primary + "15" }]}>
              <Ionicons name="people-outline" size={18} color={colors.primary} />
            </View>
            <View style={styles.infoContent}>
              <Text style={[styles.infoTitle, { color: colors.textPrimary }]}>
                {club.member_count} {club.member_count === 1 ? "member" : "members"}
              </Text>
            </View>
          </View>

          {/* Description */}
          {club.description ? (
            <>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>About</Text>
              <Text style={[styles.description, { color: colors.textSecondary }]}>{club.description}</Text>
            </>
          ) : null}

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Tabs - Only visible to members */}
          {club.is_member ? (
            <Tabs defaultValue="feed">
              <TabsList>
                <TabsTrigger value="feed">Feed</TabsTrigger>
                <TabsTrigger value="events">Events</TabsTrigger>
                <TabsTrigger value="members">Members</TabsTrigger>
              </TabsList>

            <TabsContent value="feed">
              <View style={styles.tabContent}>
                {postsLoading ? (
                  <View style={styles.tabLoading}>
                    <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading posts...</Text>
                  </View>
                ) : posts.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Ionicons name="document-text-outline" size={40} color={colors.textSecondary} />
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No posts yet.</Text>
                  </View>
                ) : (
                  posts.map((post) => <PostCard key={post.id} post={post} />)
                )}
              </View>
            </TabsContent>

            <TabsContent value="events">
              <View style={styles.tabContent}>
                {eventsLoading ? (
                  <View style={styles.tabLoading}>
                    <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading events...</Text>
                  </View>
                ) : !clubEvents || clubEvents.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Ionicons name="calendar-outline" size={40} color={colors.textSecondary} />
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No upcoming events.</Text>
                  </View>
                ) : (
                  clubEvents.map((event) => (
                    <TouchableOpacity
                      key={event.id}
                      style={[styles.eventCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                      onPress={() => router.push(`/events/${event.id}`)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.eventDateBlock, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30" }]}>
                        <Text style={[styles.eventDateMonth, { color: colors.primary }]}>
                          {new Date(event.start_time).toLocaleDateString("en-US", { month: "short" })}
                        </Text>
                        <Text style={[styles.eventDateDay, { color: colors.primary }]}>
                          {new Date(event.start_time).getDate()}
                        </Text>
                      </View>
                      <View style={styles.eventInfo}>
                        <Text style={[styles.eventTitle, { color: colors.textPrimary }]} numberOfLines={1}>{event.title}</Text>
                        <View style={styles.eventMeta}>
                          <Ionicons name="time-outline" size={12} color={colors.textSecondary} />
                          <Text style={[styles.eventMetaText, { color: colors.textSecondary }]}>
                            {new Date(event.start_time).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                          </Text>
                        </View>
                        {event.location && (
                          <View style={styles.eventMeta}>
                            <Ionicons name="location-outline" size={12} color={colors.textSecondary} />
                            <Text style={[styles.eventMetaText, { color: colors.textSecondary }]} numberOfLines={1}>{event.location}</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.eventRight}>
                        <Ionicons name="people-outline" size={13} color={colors.textSecondary} />
                        <Text style={[styles.eventRsvpText, { color: colors.textSecondary }]}>{event.rsvp_count}</Text>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            </TabsContent>

            <TabsContent value="members">
              <View style={styles.tabContent}>
                {/* Pending Members Section */}
                {isOwnerOrAdmin && pendingMembers.length > 0 && (
                  <>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                      Pending Requests ({pendingMembers.length})
                    </Text>
                    {pendingMembers.map((member) => (
                      <View
                        key={member.id}
                        style={[styles.memberRow, { borderBottomColor: colors.border }]}
                      >
                        <TouchableOpacity
                          style={{ flexDirection: "row", alignItems: "center", flex: 1 }}
                          onPress={() => router.push(`/profile/${member.user_id}`)}
                        >
                          <Avatar uri={member.avatar_url} name={member.display_name} size="md" />
                          <View style={styles.memberDetails}>
                            <Text style={[styles.memberName, { color: colors.textPrimary }]} numberOfLines={1}>{member.display_name}</Text>
                            <Text style={[styles.memberHandle, { color: colors.textSecondary }]} numberOfLines={1}>@{member.username}</Text>
                          </View>
                        </TouchableOpacity>
                        <View style={styles.approveRejectBtns}>
                          <TouchableOpacity
                            style={[styles.approveBtn, { backgroundColor: colors.primary }]}
                            onPress={() => approveMutation.mutate(member.user_id)}
                            disabled={approveMutation.isPending}
                          >
                            <Ionicons name="checkmark" size={18} color="#fff" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.rejectBtn, { backgroundColor: colors.destructive }]}
                            onPress={() => rejectMutation.mutate(member.user_id)}
                            disabled={rejectMutation.isPending}
                          >
                            <Ionicons name="close" size={18} color="#fff" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  </>
                )}

                {/* Approved Members */}
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  Members
                </Text>
                {membersLoading ? (
                  <View style={styles.tabLoading}>
                    <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading members...</Text>
                  </View>
                ) : members.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Ionicons name="people-outline" size={40} color={colors.textSecondary} />
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No members yet.</Text>
                  </View>
                ) : (
                  members.map((member) => (
                    <TouchableOpacity
                      key={member.id}
                      style={[styles.memberRow, { borderBottomColor: colors.border }]}
                      onPress={() => router.push(`/profile/${member.user_id}`)}
                    >
                      <Avatar uri={member.avatar_url} name={member.display_name} size="md" />
                      <View style={styles.memberDetails}>
                        <Text style={[styles.memberName, { color: colors.textPrimary }]} numberOfLines={1}>{member.display_name}</Text>
                        <Text style={[styles.memberHandle, { color: colors.textSecondary }]} numberOfLines={1}>@{member.username}</Text>
                      </View>
                      {member.role !== "member" && (
                        <View style={[styles.roleBadge, { backgroundColor: getRoleColor(member.role, colors) + "20" }]}>
                          <Text style={[styles.roleText, { color: getRoleColor(member.role, colors) }]}>
                            {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))
                )}
              </View>
            </TabsContent>
          </Tabs>
          ) : (
            /* Non-member view */
            <View style={styles.nonMemberContainer}>
              <View style={[styles.nonMemberCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="lock-closed-outline" size={32} color={colors.textSecondary} />
                <Text style={[styles.nonMemberTitle, { color: colors.textPrimary }]}>Join to see club content</Text>
                <Text style={[styles.nonMemberText, { color: colors.textSecondary }]}>
                  Join this club to see posts, events, and members.
                </Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom bar */}
      <View style={[styles.bottomBar, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.shareBtn, { borderColor: colors.border }]}
          onPress={() => Share.share({ message: `${club.name} — Campus Connect` }).catch(() => {})}
        >
          <Ionicons name="share-outline" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.joinBtn,
            {
              backgroundColor: club.is_member ? "transparent" : club.is_pending ? colors.warning + "20" : colors.primary,
              borderColor: club.is_member ? colors.border : club.is_pending ? colors.warning : colors.primary,
            },
          ]}
          onPress={handleJoinLeave}
          disabled={joinMutation.isPending || leaveMutation.isPending}
        >
          <Text
            style={[
              styles.joinBtnText,
              { color: club.is_member ? colors.textSecondary : club.is_pending ? colors.warning : "#fff" },
            ]}
          >
            {club.is_member ? "Joined" : club.is_pending ? "Request Pending" : joinMutation.isPending ? "Joining..." : "Join Club"}
          </Text>
        </TouchableOpacity>
      </View>

      <ReportSheet
        open={reportOpen}
        targetType="club"
        targetId={clubId || id}
        onClose={() => setReportOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { fontSize: fontSize.md },
  banner: { width: "100%", height: 180 },
  bannerPlaceholder: { width: "100%", height: 180, alignItems: "center", justifyContent: "center" },
  headerOverlay: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  content: { padding: 16 },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: 14,
  },
  avatarContainer: { borderWidth: 3, borderRadius: borderRadius.full },
  nameText: { flex: 1 },
  nameLine: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  clubName: { fontSize: 20, fontWeight: "700", flex: 1 },
  categoryText: { fontSize: fontSize.sm, marginTop: 2 },
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
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 16 },
  sectionTitle: { fontSize: 16, fontWeight: "600", marginBottom: 12 },
  description: { fontSize: 15, lineHeight: 22 },
  tabContent: { minHeight: 200 },
  tabLoading: { paddingVertical: spacing.xxl * 2, alignItems: "center" },
  emptyState: { alignItems: "center", paddingVertical: spacing.xxl * 2, gap: spacing.md },
  emptyText: { fontSize: fontSize.md, textAlign: "center" },
  eventCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  eventDateBlock: { width: 48, alignItems: "center", paddingVertical: spacing.xs, borderRadius: borderRadius.sm, borderWidth: 1 },
  eventDateMonth: { fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  eventDateDay: { fontSize: fontSize.lg, fontWeight: "800" },
  eventInfo: { flex: 1 },
  eventTitle: { fontSize: fontSize.sm, fontWeight: "600", marginBottom: 2 },
  eventMeta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  eventMetaText: { fontSize: fontSize.xs },
  eventRight: { alignItems: "center", gap: 2 },
  eventRsvpText: { fontSize: fontSize.xs, fontWeight: "600" },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  memberDetails: { flex: 1, marginLeft: spacing.sm },
  memberName: { fontSize: fontSize.md, fontWeight: "500" },
  memberHandle: { fontSize: fontSize.sm },
  roleBadge: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.sm },
  roleText: { fontSize: fontSize.xs, fontWeight: "600" },
  approveRejectBtns: { flexDirection: "row", gap: 6 },
  approveBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  rejectBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  nonMemberContainer: {
    paddingVertical: spacing.xl,
  },
  nonMemberCard: {
    alignItems: "center",
    padding: spacing.xl,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    gap: spacing.md,
  },
  nonMemberTitle: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    textAlign: "center",
  },
  nonMemberText: {
    fontSize: fontSize.md,
    textAlign: "center",
    lineHeight: 20,
  },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  shareBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  joinBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  joinBtnText: { fontSize: 15, fontWeight: "600" },
});
