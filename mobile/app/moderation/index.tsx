import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { api } from "../../lib/api-client";
import { useAuth } from "../../hooks/useAuth";
import { useTheme } from "../../lib/theme-context";
import { Ionicons } from "@expo/vector-icons";
import { spacing, fontSize, borderRadius } from "../../lib/theme";
import { useToast } from "../../components/Toast";
import type { Report } from "../../types";

const STATUS_FILTERS = [
  { label: "All", value: "" },
  { label: "Pending", value: "pending" },
  { label: "Reviewing", value: "reviewing" },
  { label: "Resolved", value: "resolved" },
  { label: "Dismissed", value: "dismissed" },
];

const TARGET_TYPE_FILTERS = [
  { label: "All", value: "" },
  { label: "Post", value: "post" },
  { label: "Comment", value: "comment" },
  { label: "User", value: "user" },
  { label: "Listing", value: "listing" },
  { label: "Club", value: "club" },
  { label: "Message", value: "message" },
];

const CATEGORY_FILTERS = [
  { label: "All", value: "" },
  { label: "Spam", value: "spam" },
  { label: "Hate Speech", value: "hate_speech" },
  { label: "Misinformation", value: "misinformation" },
  { label: "Inappropriate", value: "inappropriate" },
  { label: "Harassment", value: "harassment" },
  { label: "Other", value: "other" },
];

const CATEGORY_LABELS: Record<string, string> = {
  spam: "Spam",
  hate_speech: "Hate Speech",
  misinformation: "Misinformation",
  inappropriate: "Inappropriate",
  harassment: "Harassment",
  other: "Other",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "#eab308",
  reviewing: "#3b82f6",
  resolved: "#22c55e",
  dismissed: "#6b7280",
};

export default function ModerationScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("");
  const [targetTypeFilter, setTargetTypeFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  // Cross-platform replacement for Alert.prompt (iOS-only). A single modal
  // collects optional resolution/dismissal notes before a status change.
  const [notePrompt, setNotePrompt] = useState<{
    report: Report;
    action: "resolved" | "dismissed";
    note: string;
    submitting: boolean;
  } | null>(null);

  const isModerator = user?.role === "moderator" || user?.role === "university_staff";

  const { data, refetch, isRefetching, isLoading } = useQuery({
    queryKey: ["reports", statusFilter, targetTypeFilter, categoryFilter],
    queryFn: () =>
      api.get<{ items: Report[] }>("/moderation/reports", {
        params: {
          limit: "20",
          ...(statusFilter ? { status: statusFilter } : {}),
          ...(targetTypeFilter ? { target_type: targetTypeFilter } : {}),
          ...(categoryFilter ? { category: categoryFilter } : {}),
        },
      }),
    enabled: isModerator,
  });

  const reports = data?.items || [];

  if (!user) return null;

  if (!isModerator) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Moderation</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.centerContent}>
          <Ionicons name="shield-outline" size={32} color={colors.textSecondary} />
          <Text style={[styles.centerTitle, { color: colors.textPrimary }]}>Moderators only</Text>
          <Text style={[styles.centerDescription, { color: colors.textSecondary }]}>
            You don't have permission to view this page.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Opens the note-entry modal for resolve/dismiss. The actual status change
  // is applied by submitReportStatus once the moderator confirms the note.
  const handleResolve = (item: Report) => {
    setNotePrompt({ report: item, action: "resolved", note: "", submitting: false });
  };

  const handleDismiss = (item: Report) => {
    setNotePrompt({ report: item, action: "dismissed", note: "", submitting: false });
  };

  const submitReportStatus = async () => {
    if (!notePrompt) return;
    const { report, action, note } = notePrompt;
    setNotePrompt({ ...notePrompt, submitting: true });
    try {
      // Backend ReportUpdate expects `resolution_note` (not `notes`).
      await api.patch(`/moderation/reports/${report.id}`, {
        status: action,
        resolution_note: note.trim() || null,
      });
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
      toast(action === "resolved" ? "Report resolved" : "Report dismissed", "success");
    } catch {
      toast("Failed to update report", "error");
    } finally {
      setNotePrompt(null);
    }
  };

  const handleSuspendUser = (item: Report) => {
    Alert.alert(
      "Suspend User",
      `Suspend user for how long?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "1 day",
          onPress: () => confirmSuspend(item.target_id, "1d"),
        },
        {
          text: "7 days",
          onPress: () => confirmSuspend(item.target_id, "7d"),
        },
        {
          text: "30 days",
          style: "destructive",
          onPress: () => confirmSuspend(item.target_id, "30d"),
        },
      ]
    );
  };

  const confirmSuspend = (targetId: string, duration: "1d" | "7d" | "30d") => {
    const label = duration === "1d" ? "1 day" : duration === "7d" ? "7 days" : "30 days";
    Alert.alert(
      "Confirm Suspension",
      `Are you sure you want to suspend this user for ${label}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Suspend",
          style: "destructive",
          onPress: () => {
            api.post(`/users/${targetId}/suspend`, { duration })
              .then(() => queryClient.invalidateQueries({ queryKey: ["reports"] }));
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: Report }) => (
    <View style={[styles.reportCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.reportHeader}>
        <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] + "20" }]}>
          <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] }]}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </Text>
        </View>
        <Text style={[styles.categoryText, { color: colors.textSecondary }]}>
          {CATEGORY_LABELS[item.category] || item.category}
        </Text>
      </View>

      <Text style={[styles.reasonText, { color: colors.textPrimary }]} numberOfLines={3}>
        {item.reason}
      </Text>

      {item.content_preview ? (
        <View style={[styles.contentPreviewBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Text style={[styles.contentPreviewLabel, { color: colors.textSecondary }]}>Content Preview</Text>
          <Text style={[styles.contentPreviewText, { color: colors.textPrimary }]} numberOfLines={4}>
            {item.content_preview}
          </Text>
        </View>
      ) : (
        <View style={[styles.contentPreviewBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Text style={[styles.contentPreviewLabel, { color: colors.textSecondary }]}>Report Category</Text>
          <Text style={[styles.contentPreviewText, { color: colors.textPrimary }]}>
            {CATEGORY_LABELS[item.category] || item.category} — {item.target_type.charAt(0).toUpperCase() + item.target_type.slice(1)}
          </Text>
        </View>
      )}

      <View style={styles.reportFooter}>
        <Text style={[styles.targetText, { color: colors.textSecondary }]}>
          {item.target_type.charAt(0).toUpperCase() + item.target_type.slice(1)}
        </Text>
        <Text style={[styles.dateText, { color: colors.textSecondary }]}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>

      <View style={styles.reportActions}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.primary + "20" }]}
          onPress={() => handleResolve(item)}
        >
          <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
          <Text style={[styles.actionText, { color: colors.primary }]}>Resolve</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.muted }]}
          onPress={() => handleDismiss(item)}
        >
          <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
          <Text style={[styles.actionText, { color: colors.textSecondary }]}>Dismiss</Text>
        </TouchableOpacity>
        {item.target_type === "user" && item.status === "pending" && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: "#ef444420" }]}
            onPress={() => handleSuspendUser(item)}
          >
            <Ionicons name="ban" size={16} color="#ef4444" />
            <Text style={[styles.actionText, { color: "#ef4444" }]}>Suspend</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Moderation</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Filters */}
      <View style={[styles.filtersContainer, { borderBottomColor: colors.border }]}>
        {/* Status filters */}
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={STATUS_FILTERS}
          keyExtractor={(item) => item.value}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterChip,
                {
                  backgroundColor: statusFilter === item.value ? colors.primary : "transparent",
                  borderColor: statusFilter === item.value ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setStatusFilter(item.value)}
            >
              <Text
                style={[
                  styles.filterText,
                  { color: statusFilter === item.value ? colors.primaryForeground : colors.textSecondary },
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.filterRow}
        />
        {/* Target type filters */}
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={TARGET_TYPE_FILTERS}
          keyExtractor={(item) => item.value}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterChip,
                {
                  backgroundColor: targetTypeFilter === item.value ? colors.primary : "transparent",
                  borderColor: targetTypeFilter === item.value ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setTargetTypeFilter(item.value)}
            >
              <Text
                style={[
                  styles.filterText,
                  { color: targetTypeFilter === item.value ? colors.primaryForeground : colors.textSecondary },
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.filterRow}
        />
        {/* Category filters */}
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={CATEGORY_FILTERS}
          keyExtractor={(item) => item.value}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterChip,
                {
                  backgroundColor: categoryFilter === item.value ? colors.primary : "transparent",
                  borderColor: categoryFilter === item.value ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setCategoryFilter(item.value)}
            >
              <Text
                style={[
                  styles.filterText,
                  { color: categoryFilter === item.value ? colors.primaryForeground : colors.textSecondary },
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.filterRow}
        />
      </View>

      {/* Reports list */}
      {isLoading ? (
        <ActivityIndicator style={styles.loading} />
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="shield-outline" size={40} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No reports found.</Text>
            </View>
          }
        />
      )}

      {/* Cross-platform note-entry modal (replaces iOS-only Alert.prompt) */}
      <Modal
        visible={notePrompt !== null}
        transparent
        animationType="fade"
        onRequestClose={() => !notePrompt?.submitting && setNotePrompt(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.noteOverlay}
        >
          <Pressable style={styles.noteOverlay} onPress={() => !notePrompt?.submitting && setNotePrompt(null)}>
            <Pressable
              style={[styles.noteSheet, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={(e) => e.stopPropagation()}
            >
              <Text style={[styles.noteTitle, { color: colors.textPrimary }]}>
                {notePrompt?.action === "resolved" ? "Resolve Report" : "Dismiss Report"}
              </Text>
              <Text style={[styles.noteDescription, { color: colors.textSecondary }]}>
                Add optional {notePrompt?.action === "resolved" ? "resolution" : "dismissal"} notes (or leave blank):
              </Text>
              <TextInput
                style={[styles.noteInput, { color: colors.textPrimary, backgroundColor: colors.muted, borderColor: colors.border }]}
                value={notePrompt?.note ?? ""}
                onChangeText={(text) => notePrompt && setNotePrompt({ ...notePrompt, note: text })}
                placeholder="Optional notes..."
                placeholderTextColor={colors.textTertiary}
                multiline
                autoFocus
                editable={!notePrompt?.submitting}
              />
              <View style={styles.noteActions}>
                <TouchableOpacity
                  style={[styles.noteButton, styles.noteButtonSecondary, { borderColor: colors.border }]}
                  onPress={() => setNotePrompt(null)}
                  disabled={notePrompt?.submitting}
                >
                  <Text style={[styles.noteButtonText, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.noteButton,
                    {
                      backgroundColor: notePrompt?.action === "resolved" ? colors.success : colors.textSecondary,
                    },
                  ]}
                  onPress={submitReportStatus}
                  disabled={notePrompt?.submitting}
                >
                  <Text style={[styles.noteButtonText, { color: colors.textInverse }]}>
                    {notePrompt?.submitting ? "Saving..." : notePrompt?.action === "resolved" ? "Resolve" : "Dismiss"}
                  </Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
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
  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  centerTitle: {
    fontSize: fontSize.lg,
    fontWeight: "600",
  },
  centerDescription: {
    fontSize: fontSize.sm,
    textAlign: "center",
  },
  filtersContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
    borderBottomWidth: 1,
  },
  filterRow: {
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  filterText: {
    fontSize: fontSize.xs,
    fontWeight: "500",
  },
  list: {
    padding: spacing.lg,
  },
  reportCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  reportHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    fontSize: fontSize.xs,
    fontWeight: "600",
  },
  categoryText: {
    fontSize: fontSize.xs,
    fontWeight: "500",
  },
  reasonText: {
    fontSize: fontSize.md,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  reportFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  targetText: {
    fontSize: fontSize.xs,
  },
  dateText: {
    fontSize: fontSize.xs,
  },
  contentPreviewBox: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  contentPreviewLabel: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    marginBottom: spacing.xs,
    textTransform: "uppercase",
  },
  contentPreviewText: {
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  reportActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  actionText: {
    fontSize: fontSize.sm,
    fontWeight: "500",
  },
  loading: {
    marginTop: spacing.xxl * 2,
  },
  empty: {
    alignItems: "center",
    paddingVertical: spacing.xxl * 3,
    gap: spacing.md,
  },
  emptyText: {
    fontSize: fontSize.md,
  },
  noteOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    padding: spacing.xl,
  },
  noteSheet: {
    width: "100%",
    maxWidth: 400,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.xl,
  },
  noteTitle: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    marginBottom: spacing.xs,
  },
  noteDescription: {
    fontSize: fontSize.sm,
    marginBottom: spacing.md,
  },
  noteInput: {
    minHeight: 80,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: fontSize.md,
    textAlignVertical: "top",
  },
  noteActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  noteButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  noteButtonSecondary: {
    borderWidth: 1,
  },
  noteButtonText: {
    fontSize: fontSize.md,
    fontWeight: "600",
  },
});
