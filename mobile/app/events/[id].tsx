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
  Share,
  Linking,
  Modal,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api-client";
import { useTheme } from "../../lib/theme-context";
import { useAuth } from "../../hooks/useAuth";
import { Avatar } from "../../components/Avatar";
import { ReportSheet } from "../../components/ReportSheet";
import { Ionicons } from "@expo/vector-icons";
import type { Event, EventAttendees } from "../../types";

function formatDateTime(dateString: string): { date: string; time: string } {
  const date = new Date(dateString);
  return {
    date: date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }),
    time: date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
  };
}

function getRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

const RSVP_OPTIONS = [
  { key: "going", label: "Going", icon: "checkmark-circle" as const, color: "#22c55e" },
  { key: "maybe", label: "Maybe", icon: "help-circle" as const, color: "#f59e0b" },
  { key: "not_going", label: "Can't Go", icon: "close-circle" as const, color: "#ef4444" },
];

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [reportOpen, setReportOpen] = useState(false);
  const [attendeesOpen, setAttendeesOpen] = useState(false);
  const [attendeesTab, setAttendeesTab] = useState<"going" | "maybe" | "not_going">("going");

  const { data: event } = useQuery({
    queryKey: ["event", id],
    queryFn: () => api.get<Event>(`/events/${id}`),
  });

  const { data: attendees } = useQuery({
    queryKey: ["event-attendees", id],
    queryFn: () => api.get<EventAttendees>(`/events/${id}/attendees`),
  });

  const rsvpMutation = useMutation({
    mutationFn: (status: string) => api.post(`/events/${id}/rsvp`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event", id] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["event-attendees", id] });
    },
    onError: (error: Error) => Alert.alert("Error", error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/events/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      router.back();
    },
    onError: (error: Error) => Alert.alert("Error", error.message),
  });

  const isOrganizer = user?.id === event?.organizer_id;

  const handleEdit = () => {
    router.push(`/events/edit?id=${id}`);
  };

  const handleDelete = () => {
    Alert.alert("Delete Event", "Are you sure you want to delete this event?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteMutation.mutate() },
    ]);
  };

  if (!event) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loading}>
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const start = formatDateTime(event.start_time);
  const end = event.end_time ? formatDateTime(event.end_time) : null;
  const spotsLeft = event.rsvp_limit ? event.rsvp_limit - event.rsvp_count : null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView>
        {/* Cover image */}
        {event.cover_image_url ? (
          <Image source={{ uri: event.cover_image_url }} style={styles.coverImage} />
        ) : (
          <View style={[styles.coverPlaceholder, { backgroundColor: colors.primary + "15" }]}>
            <Ionicons name="calendar" size={48} color={colors.primary} />
          </View>
        )}

        {/* Header overlay */}
        <View style={[styles.header, { backgroundColor: colors.background }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setReportOpen(true)}>
            <Ionicons name="flag-outline" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {/* Title + Status */}
          <View style={styles.titleRow}>
            <Text style={[styles.eventTitle, { color: colors.textPrimary }]}>{event.title}</Text>
            {event.status !== "active" && (
              <View style={[styles.statusBadge, { backgroundColor: colors.muted }]}>
                <Text style={[styles.statusText, { color: colors.textSecondary }]}>{event.status}</Text>
              </View>
            )}
          </View>

          {/* Date & Time */}
          <View style={styles.infoRow}>
            <View style={[styles.infoIcon, { backgroundColor: colors.primary + "15" }]}>
              <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            </View>
            <View style={styles.infoContent}>
              <Text style={[styles.infoTitle, { color: colors.textPrimary }]}>{start.date}</Text>
              <Text style={[styles.infoSubtitle, { color: colors.textSecondary }]}>
                {start.time}{end ? ` — ${end.time}` : ""}
              </Text>
            </View>
          </View>

          {/* Location */}
          {event.location && (
            <TouchableOpacity
              style={styles.infoRow}
              onPress={() => {
                const query = encodeURIComponent(event.location!);
                Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
              }}
            >
              <View style={[styles.infoIcon, { backgroundColor: colors.primary + "15" }]}>
                <Ionicons name="location-outline" size={18} color={colors.primary} />
              </View>
              <View style={styles.infoContent}>
                <Text style={[styles.infoTitle, { color: colors.primary }]}>{event.location}</Text>
                <Text style={[styles.infoSubtitle, { color: colors.primary }]}>Open in Maps</Text>
              </View>
              <Ionicons name="open-outline" size={14} color={colors.primary} />
            </TouchableOpacity>
          )}

          {/* Attendees */}
          <View style={styles.infoRow}>
            <View style={[styles.infoIcon, { backgroundColor: colors.primary + "15" }]}>
              <Ionicons name="people-outline" size={18} color={colors.primary} />
            </View>
            <View style={styles.infoContent}>
              <Text style={[styles.infoTitle, { color: colors.textPrimary }]}>
                {event.rsvp_count} {event.rsvp_count === 1 ? "person" : "people"} going
              </Text>
              {spotsLeft != null && (
                <Text style={[styles.infoSubtitle, { color: spotsLeft <= 5 ? colors.error : colors.textSecondary }]}>
                  {spotsLeft > 0 ? `${spotsLeft} spots left` : "Event full"}
                </Text>
              )}
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Organizer */}
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Organized by</Text>
          <TouchableOpacity
            style={styles.organizerRow}
            onPress={() => router.push(`/profile/${event.organizer.id}`)}
          >
            <Avatar uri={event.organizer.profile?.avatar_url} name={event.organizer.profile?.display_name || event.organizer.email} size="md" />
            <View style={styles.organizerInfo}>
              <Text style={[styles.organizerName, { color: colors.textPrimary }]}>
                {event.organizer.profile?.display_name || event.organizer.email}
              </Text>
              {event.organizer.username && (
                <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
                  @{event.organizer.username}
                </Text>
              )}
              <Text style={[styles.organizerSub, { color: colors.textSecondary }]}>Organizer</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Club */}
          {event.club && (
            <TouchableOpacity
              style={styles.organizerRow}
              onPress={() => router.push(`/clubs/${event.club!.slug}`)}
            >
              <View style={[styles.clubIcon, { backgroundColor: colors.primary + "15" }]}>
                <Ionicons name="people-circle" size={28} color={colors.primary} />
              </View>
              <View style={styles.organizerInfo}>
                <Text style={[styles.organizerName, { color: colors.textPrimary }]}>{event.club!.name}</Text>
                <Text style={[styles.organizerSub, { color: colors.textSecondary }]}>Club</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}

          {/* Description */}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>About this event</Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>{event.description || "No description provided."}</Text>

          {/* Attendees List */}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <TouchableOpacity
            style={styles.attendeesHeader}
            onPress={() => setAttendeesOpen(true)}
          >
            <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 0 }]}>Attendees</Text>
            <View style={styles.attendeesCounts}>
              {attendees?.going.length ? (
                <View style={[styles.countBadge, { backgroundColor: "#22c55e" + "18" }]}>
                  <Ionicons name="checkmark-circle" size={12} color="#22c55e" />
                  <Text style={[styles.countText, { color: "#22c55e" }]}>{attendees.going.length}</Text>
                </View>
              ) : null}
              {attendees?.maybe.length ? (
                <View style={[styles.countBadge, { backgroundColor: "#f59e0b" + "18" }]}>
                  <Ionicons name="help-circle" size={12} color="#f59e0b" />
                  <Text style={[styles.countText, { color: "#f59e0b" }]}>{attendees.maybe.length}</Text>
                </View>
              ) : null}
              {attendees?.not_going.length ? (
                <View style={[styles.countBadge, { backgroundColor: "#ef4444" + "18" }]}>
                  <Ionicons name="close-circle" size={12} color="#ef4444" />
                  <Text style={[styles.countText, { color: "#ef4444" }]}>{attendees.not_going.length}</Text>
                </View>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* RSVP Section — only for non-organizers */}
          {!isOrganizer && (
            <>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Are you going?</Text>
              <View style={styles.rsvpButtons}>
                {RSVP_OPTIONS.map((opt) => {
                  const isActive = event.user_rsvp === opt.key;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[
                        styles.rsvpButton,
                        { borderColor: isActive ? opt.color : colors.border, backgroundColor: isActive ? opt.color + "15" : "transparent" },
                      ]}
                      onPress={() => rsvpMutation.mutate(opt.key)}
                    >
                      <Ionicons name={opt.icon} size={20} color={isActive ? opt.color : colors.textSecondary} />
                      <Text style={[styles.rsvpLabel, { color: isActive ? opt.color : colors.textPrimary }]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {/* Bottom bar */}
      <View style={[styles.bottomBar, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        {isOrganizer ? (
          <>
            <TouchableOpacity
              style={[styles.shareBtn, { borderColor: colors.border }]}
              onPress={() => Share.share({ message: `${event.title} — Campus Connect` }).catch(() => {})}
            >
              <Ionicons name="share-outline" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.editBtn, { borderColor: colors.primary, backgroundColor: colors.primary + "10" }]}
              onPress={handleEdit}
            >
              <Ionicons name="create-outline" size={18} color={colors.primary} />
              <Text style={[styles.editBtnText, { color: colors.primary }]}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.deleteBtn, { borderColor: "#ef4444", backgroundColor: "#ef444410" }]}
              onPress={handleDelete}
            >
              <Ionicons name="trash-outline" size={18} color="#ef4444" />
              <Text style={[styles.deleteBtnText, { color: "#ef4444" }]}>Delete</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.shareBtn, { borderColor: colors.border }]}
              onPress={() => Share.share({ message: `${event.title} — Campus Connect` }).catch(() => {})}
            >
              <Ionicons name="share-outline" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.rsvpNowBtn, { backgroundColor: colors.primary }]}
              onPress={() => rsvpMutation.mutate("going")}
            >
              <Text style={styles.rsvpNowBtnText}>
                {event.user_rsvp === "going" ? "You're Going ✓" : "RSVP — Going"}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Attendees Modal */}
      <Modal visible={attendeesOpen} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Attendees</Text>
              <TouchableOpacity onPress={() => setAttendeesOpen(false)}>
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Tabs */}
            <View style={styles.modalTabs}>
              {(["going", "maybe", "not_going"] as const).map((tab) => {
                const count = attendees?.[tab]?.length || 0;
                const tabColors = { going: "#22c55e", maybe: "#f59e0b", not_going: "#ef4444" };
                const labels = { going: "Going", maybe: "Maybe", not_going: "Can't Go" };
                const isActive = attendeesTab === tab;
                return (
                  <TouchableOpacity
                    key={tab}
                    style={[styles.modalTab, isActive && { borderBottomColor: tabColors[tab] }]}
                    onPress={() => setAttendeesTab(tab)}
                  >
                    <Text style={[styles.modalTabText, { color: isActive ? tabColors[tab] : colors.textSecondary }]}>
                      {labels[tab]} ({count})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* User list */}
            <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
              {attendees?.[attendeesTab]?.length ? (
                attendees[attendeesTab].map((u) => (
                  <TouchableOpacity
                    key={u.id}
                    style={styles.attendeeRow}
                    onPress={() => {
                      setAttendeesOpen(false);
                      router.push(`/profile/${u.id}`);
                    }}
                  >
                    <Avatar uri={u.avatar_url} name={u.display_name} size="sm" />
                    <Text style={[styles.attendeeName, { color: colors.textPrimary }]} numberOfLines={1}>
                      {u.display_name}
                    </Text>
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No one here yet.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <ReportSheet
        open={reportOpen}
        targetType="event"
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
  coverImage: { width: "100%", height: 200 },
  coverPlaceholder: { width: "100%", height: 200, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  content: { padding: 16 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 16 },
  eventTitle: { fontSize: 22, fontWeight: "700", flex: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 11, fontWeight: "600", textTransform: "capitalize" },
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
  organizerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  clubIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  organizerInfo: { flex: 1 },
  organizerName: { fontSize: 14, fontWeight: "500" },
  organizerSub: { fontSize: 12 },
  description: { fontSize: 15, lineHeight: 22 },
  rsvpButtons: { flexDirection: "row", gap: 10 },
  rsvpButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  rsvpLabel: { fontSize: 13, fontWeight: "600" },
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
  rsvpNowBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  rsvpNowBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  attendeesHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  attendeesCounts: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
  },
  countBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countText: { fontSize: 12, fontWeight: "600" },
  editBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  editBtnText: { fontSize: 14, fontWeight: "600" },
  deleteBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  deleteBtnText: { fontSize: 14, fontWeight: "600" },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "70%",
    paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  modalTabs: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  modalTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  modalTabText: { fontSize: 13, fontWeight: "600" },
  modalList: { paddingHorizontal: 16, paddingTop: 8 },
  attendeeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  attendeeName: { fontSize: 14, fontWeight: "500", flex: 1 },
  emptyText: { fontSize: 14, textAlign: "center", paddingVertical: 24 },
});
