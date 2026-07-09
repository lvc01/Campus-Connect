import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Alert,
  Share,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { api } from "../lib/api-client";
import { useTheme } from "../lib/theme-context";
import { borderRadius, fontSize } from "../lib/theme";
import { ReportSheet } from "./ReportSheet";

interface PostMenuProps {
  postId: string;
  authorId: string;
  content: string;
  isAuthor: boolean;
  onDeleted: (id: string) => void;
}

export function PostMenu({ postId, content, isAuthor, onDeleted }: PostMenuProps) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const handleEdit = () => {
    setOpen(false);
    router.push({
      pathname: "/(tabs)/compose",
      params: { editPostId: postId },
    });
  };

  const handleDelete = () => {
    setOpen(false);
    Alert.alert("Delete post?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/posts/${postId}`);
            onDeleted(postId);
          } catch {
            Alert.alert("Error", "Failed to delete post");
          }
        },
      },
    ]);
  };

  const handleReport = () => {
    setOpen(false);
    setReportOpen(true);
  };

  const handleShare = () => {
    setOpen(false);
    setTimeout(() => {
      Share.share({
        message: content || "Check out this post on Campus Connect",
      }).catch(() => {
        Alert.alert("Post content", content || "No content");
      });
    }, 300);
  };

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="ellipsis-horizontal" size={16} color={colors.textSecondary} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
            {/* Sheet — absorbs taps */}
            <Pressable style={[styles.sheet, { backgroundColor: colors.card }]}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />

            {/* Share — always shown */}
            <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.border }]} onPress={handleShare} activeOpacity={0.6}>
              <Ionicons name="share-outline" size={18} color={colors.textPrimary} />
              <Text style={[styles.menuText, { color: colors.textPrimary }]}>Share post</Text>
            </TouchableOpacity>

            {isAuthor ? (
              <>
                <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.border }]} onPress={handleEdit} activeOpacity={0.6}>
                  <Ionicons name="pencil" size={18} color={colors.textPrimary} />
                  <Text style={[styles.menuText, { color: colors.textPrimary }]}>Edit post</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={handleDelete} activeOpacity={0.6}>
                  <Ionicons name="trash" size={18} color={colors.destructive} />
                  <Text style={[styles.menuText, { color: colors.destructive }]}>Delete post</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={styles.menuItem} onPress={handleReport} activeOpacity={0.6}>
                <Ionicons name="flag" size={18} color={colors.textPrimary} />
                <Text style={[styles.menuText, { color: colors.textPrimary }]}>Report post</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.cancelBtn, { borderTopColor: colors.border }]}
              onPress={() => setOpen(false)}
              activeOpacity={0.6}
            >
              <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <ReportSheet
        open={reportOpen}
        targetType="post"
        targetId={postId}
        onClose={() => setReportOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingBottom: 48,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 8,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  menuText: {
    fontSize: fontSize.md,
    fontWeight: "500",
  },
  cancelBtn: {
    marginTop: 8,
    paddingVertical: 16,
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  cancelText: {
    fontSize: fontSize.md,
    fontWeight: "500",
  },
});
