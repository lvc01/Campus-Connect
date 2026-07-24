import React, { useState } from "react";
import { View, Text, Modal, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../lib/api-client";
import { useTheme } from "../lib/theme-context";
import { useToast } from "./Toast";
import { spacing, fontSize, borderRadius } from "../lib/theme";

// Backend ReportCategory enum — must stay in sync with app.models.moderation.
export const REPORT_CATEGORIES = [
  "spam",
  "harassment",
  "hate_speech",
  "inappropriate",
  "misinformation",
  "other",
] as const;

export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

export type ReportTargetType = "post" | "comment" | "user" | "listing" | "club" | "message";

const TARGET_LABEL: Record<ReportTargetType, string> = {
  post: "Post",
  comment: "Comment",
  user: "User",
  listing: "Listing",
  club: "Club",
  message: "Message",
};

interface ReportSheetProps {
  open: boolean;
  targetType: ReportTargetType;
  targetId: string;
  onClose: () => void;
}

/**
 * Cross-platform report sheet. Posts to `/reports` with the selected
 * category and an optional description. Reused by posts, clubs, comments,
 * etc. so every report flow behaves identically.
 */
export function ReportSheet({ open, targetType, targetId, onClose }: ReportSheetProps) {
  const { colors } = useTheme();
  const toast = useToast();
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory | null>(null);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setSelectedCategory(null);
    setDescription("");
    setSubmitting(false);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const submit = async (category: ReportCategory) => {
    setSubmitting(true);
    try {
      await api.post("/reports", {
        target_type: targetType,
        target_id: targetId,
        category,
        description: description.trim() || null,
      });
      toast("Report submitted. Thank you.", "success");
      reset();
      onClose();
    } catch {
      toast("Failed to submit report", "error");
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.overlay}
      >
        <Pressable style={styles.overlay} onPress={handleClose}>
          <Pressable
            style={[styles.sheet, { backgroundColor: colors.card }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              Report {TARGET_LABEL[targetType]}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Why are you reporting this? Your report is anonymous.
            </Text>

            {REPORT_CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryItem,
                    {
                      borderColor: isSelected ? colors.primary : colors.border,
                      backgroundColor: isSelected ? colors.accentLight : colors.muted,
                    },
                  ]}
                  onPress={() => setSelectedCategory(cat)}
                  disabled={submitting}
                >
                  <Text style={[styles.categoryText, { color: colors.textPrimary }]}>
                    {cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </Text>
                  {isSelected && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                </TouchableOpacity>
              );
            })}

            {selectedCategory && (
              <View style={styles.descriptionWrap}>
                <Text style={[styles.descriptionLabel, { color: colors.textSecondary }]}>
                  ADDITIONAL DETAILS (OPTIONAL)
                </Text>
                <TextInput
                  style={[styles.descriptionInput, { color: colors.textPrimary, backgroundColor: colors.muted, borderColor: colors.border }]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Provide any extra context..."
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  maxLength={2000}
                  editable={!submitting}
                />
              </View>
            )}

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.actionButton, { borderColor: colors.border }]}
                onPress={handleClose}
                disabled={submitting}
              >
                <Text style={[styles.actionText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  { backgroundColor: selectedCategory ? colors.error : colors.muted },
                ]}
                onPress={() => selectedCategory && submit(selectedCategory)}
                disabled={!selectedCategory || submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={colors.textInverse} />
                ) : (
                  <Text style={[styles.actionText, { color: colors.textInverse }]}>Submit report</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingBottom: 48,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: "600",
  },
  subtitle: {
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  categoryItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
  },
  categoryText: {
    fontSize: fontSize.md,
    fontWeight: "500",
  },
  descriptionWrap: {
    marginTop: spacing.md,
  },
  descriptionLabel: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    marginBottom: spacing.xs,
  },
  descriptionInput: {
    minHeight: 80,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: fontSize.sm,
    textAlignVertical: "top",
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  actionButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  actionText: {
    fontSize: fontSize.md,
    fontWeight: "600",
  },
});
