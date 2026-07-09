import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
  FlatList,
  Image,
  ActivityIndicator,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as DocumentPicker from "expo-document-picker";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../hooks/useAuth";
import { useTheme } from "../../lib/theme-context";
import { api } from "../../lib/api-client";
import { Avatar } from "../../components/Avatar";
import { Select } from "../../components/Select";
import { Ionicons } from "@expo/vector-icons";
import { spacing, fontSize, borderRadius } from "../../lib/theme";
import type { Post, Club, User } from "../../types";

const MAX_CHARS = 500;
const MAX_POLL_OPTIONS = 6;
const MIN_POLL_OPTIONS = 2;

export default function ComposeScreen() {
  const { editPostId } = useLocalSearchParams<{ editPostId?: string }>();
  const isEditMode = Boolean(editPostId);
  const { user } = useAuth();
  const { colors } = useTheme();

  const { data: editPost } = useQuery({
    queryKey: ["post", editPostId],
    queryFn: () => api.get<Post>(`/posts/${editPostId}`),
    enabled: isEditMode,
  });

  const [content, setContent] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video" | null>(null);
  const [documentUri, setDocumentUri] = useState<string | null>(null);
  const [documentName, setDocumentName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isPoll, setIsPoll] = useState(false);
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [selectedClubId, setSelectedClubId] = useState<string>("");
  const [isAnnouncement, setIsAnnouncement] = useState(false);
  const [mentionedUsers, setMentionedUsers] = useState<string[]>([]);

  // Mention search state
  const [mentionQuery, setMentionQuery] = useState("");
  const [showMentionSearch, setShowMentionSearch] = useState(false);
  const [mentionSearchPosition, setMentionSearchPosition] = useState(0);
  const inputRef = useRef<TextInput>(null);

  // Fetch user's clubs for the club selector
  const { data: clubsData } = useQuery({
    queryKey: ["clubs"],
    queryFn: () => api.get<Club[]>("/clubs"),
  });

  // Search users for mentions
  const { data: mentionResults, isLoading: isMentionLoading } = useQuery({
    queryKey: ["userSearch", mentionQuery],
    queryFn: () => api.get<{ users: User[] }>("/search", { params: { q: mentionQuery } }),
    enabled: mentionQuery.length >= 2,
  });

  const myClubs = (clubsData || []).filter((c) => c.is_member);
  const selectedClub = myClubs.find((c) => c.id === selectedClubId);
  const canPostAnnouncement = selectedClub?.member_role === "owner" || selectedClub?.member_role === "admin";

  useEffect(() => {
    if (editPost?.content) {
      setContent(editPost.content);
      setMentionedUsers(editPost.mentioned_users || []);
    }
  }, [editPost?.content, editPost?.mentioned_users]);

  const handleContentChange = useCallback((text: string) => {
    setContent(text);

    // Check for @mention trigger
    const cursorPos = text.length;
    const lastAtIndex = text.lastIndexOf("@", cursorPos - 1);

    if (lastAtIndex >= 0) {
      // Reject if preceded by another @
      if (lastAtIndex > 0 && text[lastAtIndex - 1] === "@") {
        setShowMentionSearch(false);
        setMentionQuery("");
        return;
      }
      const textAfterAt = text.slice(lastAtIndex + 1, cursorPos);
      if (!textAfterAt.includes(" ") && textAfterAt.length < 30) {
        setMentionQuery(textAfterAt);
        setShowMentionSearch(true);
        setMentionSearchPosition(lastAtIndex);
        return;
      }
    }
    setShowMentionSearch(false);
    setMentionQuery("");
  }, []);

  const insertMention = useCallback((selectedUser: User) => {
    const username = selectedUser.username || selectedUser.email?.split("@")[0] || "";
    const displayName = selectedUser.profile?.display_name || username;
    const beforeAt = content.slice(0, mentionSearchPosition);
    const afterCursor = content.slice(mentionSearchPosition + mentionQuery.length + 1);
    const newText = `${beforeAt}@${displayName} ${afterCursor}`;

    setContent(newText);
    setMentionedUsers((prev) => [...prev, selectedUser.id]);
    setShowMentionSearch(false);
    setMentionQuery("");
    inputRef.current?.focus();
  }, [content, mentionSearchPosition, mentionQuery]);

  const charCount = content.length;
  const isOverLimit = charCount > MAX_CHARS;
  const canPost = content.trim() && !isOverLimit && !loading;

  const pickMedia = async (type: "image" | "video") => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: type === "video" ? ["videos"] : ["images"],
      allowsEditing: type === "image",
      aspect: type === "image" ? [4, 3] : undefined,
      quality: 0.8,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      if (type === "image") {
        const manipulated = await ImageManipulator.manipulateAsync(
          asset.uri,
          [{ resize: { width: 1200 } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
        );
        setImageUri(manipulated.uri);
      } else {
        setImageUri(asset.uri);
      }
      setMediaType(type);
    }
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "*/*",
      copyToCacheDirectory: true,
    });
    if (!result.canceled) {
      const file = result.assets[0];
      setDocumentUri(file.uri);
      setDocumentName(file.name);
    }
  };

  const addPollOption = () => {
    if (pollOptions.length < MAX_POLL_OPTIONS) {
      setPollOptions([...pollOptions, ""]);
    }
  };

  const removePollOption = (index: number) => {
    if (pollOptions.length > MIN_POLL_OPTIONS) {
      setPollOptions(pollOptions.filter((_, i) => i !== index));
    }
  };

  const updatePollOption = (index: number, value: string) => {
    const updated = [...pollOptions];
    updated[index] = value;
    setPollOptions(updated);
  };

  const handleSubmit = async () => {
    if (!content.trim()) {
      Alert.alert("Error", "Please write something");
      return;
    }
    if (isOverLimit) {
      Alert.alert("Error", `Post exceeds ${MAX_CHARS} character limit`);
      return;
    }
    if (isPoll) {
      const filledOptions = pollOptions.filter((o) => o.trim());
      if (filledOptions.length < MIN_POLL_OPTIONS) {
        Alert.alert("Error", `Add at least ${MIN_POLL_OPTIONS} poll options`);
        return;
      }
    }

    setLoading(true);
    try {
      let mediaUrl = null;
      if (imageUri) {
        const formData = new FormData();
        const isVideo = mediaType === "video";
        formData.append("file", {
          uri: imageUri,
          type: isVideo ? "video/mp4" : "image/jpeg",
          name: isVideo ? "post.mp4" : "post.jpg",
        } as unknown as Blob);
        const uploadResult = await api.post<{ url: string }>("/posts/upload", formData, { timeoutMs: 180000 });
        mediaUrl = uploadResult.url;
      }

      let documentUrl = null;
      if (documentUri) {
        const formData = new FormData();
        formData.append("file", {
          uri: documentUri,
          type: "application/octet-stream",
          name: documentName || "document",
        } as unknown as Blob);
        const uploadResult = await api.post<{ url: string }>("/posts/upload", formData, { timeoutMs: 180000 });
        documentUrl = uploadResult.url;
      }

      if (isEditMode) {
        await api.patch(`/posts/${editPostId}`, {
          content: content.trim(),
          mentioned_users: mentionedUsers.length > 0 ? mentionedUsers : undefined,
        });
      } else {
        const payload: Record<string, unknown> = {
          content: content.trim(),
          media_url: mediaUrl,
          document_url: documentUrl,
        };

        if (mediaType === "video") {
          payload.message_type = "video";
        }

        if (isPoll) {
          payload.post_type = "poll";
          payload.poll_options = pollOptions
            .filter((o) => o.trim())
            .map((text, index) => ({ text: text.trim(), position: index }));
        }

        if (selectedClubId) {
          payload.club_id = selectedClubId;
        }
        if (isAnnouncement && selectedClubId) {
          payload.visibility = "club_only";
        }

        if (mentionedUsers.length > 0) {
          payload.mentioned_users = mentionedUsers;
        }

        await api.post("/posts", payload);
      }
      setContent("");
      setImageUri(null);
      setMediaType(null);
      setDocumentUri(null);
      setDocumentName(null);
      setIsPoll(false);
      setPollOptions(["", ""]);
      setMentionedUsers([]);
      router.back();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to post";
      Alert.alert("Error", message);
    } finally {
      setLoading(false);
    }
  };

  const mentionUsers = mentionResults?.users || [];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="close" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {isEditMode ? "Edit Post" : "New Post"}
        </Text>
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={!canPost}
          style={[styles.postBtn, { backgroundColor: canPost ? colors.primary : colors.muted }]}
        >
          <Text style={[styles.postBtnText, { color: canPost ? colors.primaryForeground : colors.textSecondary }]}>
            {loading ? "Posting..." : "Post"}
          </Text>
        </TouchableOpacity>
      </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* User info + input */}
          <View style={styles.inputSection}>
            <Avatar uri={user?.profile?.avatar_url} name={user?.profile?.display_name || user?.email || "U"} size="md" />
            <View style={styles.inputWrapper}>
              <Text style={[styles.userName, { color: colors.textPrimary }]}>
                {user?.profile?.display_name || user?.email?.split("@")[0] || "You"}
              </Text>
              <View style={styles.inputContainer}>
                {content.length > 0 ? (
                  <Text style={[styles.inputOverlay, { color: colors.textPrimary }]}>
                    {content.split(/(#\w+|(?<!@)@[\w.]+)/g).map((part, i) =>
                      part.startsWith("#") ? (
                        <Text key={i} style={{ color: colors.primary, fontWeight: "500" }}>{part}</Text>
                      ) : part.startsWith("@") && !part.startsWith("@@") ? (
                        <Text key={i} style={{ color: "#ef4444", fontWeight: "500" }}>{part}</Text>
                      ) : (
                        <Text key={i}>{part}</Text>
                      )
                    )}
                  </Text>
                ) : (
                  <Text style={[styles.inputOverlay, { color: colors.textTertiary }]}>
                    What's on your mind?
                  </Text>
                )}
                <TextInput
                  ref={inputRef}
                  style={[styles.input, styles.inputTransparent]}
                  placeholder=""
                  value={content}
                  onChangeText={handleContentChange}
                  multiline
                  autoFocus={!isEditMode}
                  textAlignVertical="top"
                />
              </View>
            </View>
          </View>

          {/* Character counter */}
          <View style={styles.charCounter}>
            <View style={[styles.charBar, { backgroundColor: colors.muted }]}>
              <View
                style={[
                  styles.charBarFill,
                  {
                    width: `${Math.min((charCount / MAX_CHARS) * 100, 100)}%`,
                    backgroundColor: isOverLimit ? colors.error : charCount > MAX_CHARS * 0.8 ? colors.warning : colors.primary,
                  },
                ]}
              />
            </View>
            <Text
              style={[
                styles.charText,
                { color: isOverLimit ? colors.error : charCount > MAX_CHARS * 0.8 ? colors.warning : colors.textTertiary },
              ]}
            >
              {charCount}/{MAX_CHARS}
            </Text>
          </View>

          {/* Media preview */}
          {imageUri && (
            <View style={[styles.mediaPreview, { backgroundColor: colors.muted }]}>
              <Image source={{ uri: imageUri }} style={styles.mediaImage} resizeMode="cover" />
              <TouchableOpacity
                style={[styles.mediaRemove, { backgroundColor: colors.error }]}
                onPress={() => { setImageUri(null); setMediaType(null); }}
              >
                <Ionicons name="close" size={16} color="#fff" />
              </TouchableOpacity>
              <View style={[styles.mediaBadge, { backgroundColor: colors.primary }]}>
                <Ionicons name={mediaType === "video" ? "videocam" : "image"} size={12} color="#fff" />
                <Text style={styles.mediaBadgeText}>{mediaType === "video" ? "Video" : "Photo"}</Text>
              </View>
            </View>
          )}

          {/* Document preview */}
          {documentUri && (
            <View style={[styles.documentPreview, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Ionicons name="document-text" size={24} color={colors.primary} />
              <Text style={[styles.documentName, { color: colors.textPrimary }]} numberOfLines={1}>
                {documentName}
              </Text>
              <TouchableOpacity
                onPress={() => { setDocumentUri(null); setDocumentName(null); }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Toolbar */}
          <View style={[styles.toolbar, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
            <TouchableOpacity
              style={styles.toolButton}
              onPress={() => {
                Alert.alert("Add Media", "Choose media type", [
                  { text: "Photo", onPress: () => pickMedia("image") },
                  { text: "Video", onPress: () => pickMedia("video") },
                  { text: "Cancel", style: "cancel" },
                ]);
              }}
            >
              <Ionicons name="image-outline" size={22} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolButton} onPress={pickDocument}>
              <Ionicons name="document-outline" size={22} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toolButton, isPoll && { backgroundColor: colors.primary + "15" }]}
              onPress={() => setIsPoll(!isPoll)}
            >
              <Ionicons name="bar-chart-outline" size={22} color={isPoll ? colors.primary : colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toolButton, mentionedUsers.length > 0 && { opacity: 0.3 }]}
              disabled={mentionedUsers.length > 0}
              onPress={() => {
                const pos = content.length;
                const newText = content + "@";
                setContent(newText);
                inputRef.current?.focus();
                setShowMentionSearch(true);
                setMentionSearchPosition(pos);
                setMentionQuery("");
              }}
            >
              <Ionicons name="at-outline" size={22} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {/* Club selector */}
          {myClubs.length > 0 && (
            <View style={[styles.section, { borderTopColor: colors.border }]}>
              <View style={styles.sectionRow}>
                <Ionicons name="people-circle-outline" size={20} color={colors.textSecondary} />
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Post to Club</Text>
              </View>
              <Select
                options={myClubs.map((c) => ({ label: c.name, value: c.id }))}
                value={selectedClubId}
                onValueChange={(val) => {
                  setSelectedClubId(val);
                  if (!val) setIsAnnouncement(false);
                }}
                placeholder="Select a club (optional)"
              />
              {selectedClubId && canPostAnnouncement && (
                <View style={styles.switchRow}>
                  <Text style={[styles.switchLabel, { color: colors.textPrimary }]}>Club Announcement</Text>
                  <Switch
                    value={isAnnouncement}
                    onValueChange={setIsAnnouncement}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor={colors.primaryForeground}
                  />
                </View>
              )}
            </View>
          )}

          {/* Poll section */}
          {isPoll && (
            <View style={[styles.section, { borderTopColor: colors.border }]}>
              <View style={styles.sectionRow}>
                <Ionicons name="bar-chart-outline" size={20} color={colors.primary} />
                <Text style={[styles.sectionLabel, { color: colors.primary }]}>Poll</Text>
              </View>
              {pollOptions.map((option, index) => (
                <View key={index} style={styles.pollOptionRow}>
                  <View style={[styles.pollDot, { backgroundColor: colors.primary }]} />
                  <TextInput
                    style={[styles.pollInput, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.background }]}
                    placeholder={`Option ${index + 1}`}
                    placeholderTextColor={colors.textTertiary}
                    value={option}
                    onChangeText={(val) => updatePollOption(index, val)}
                  />
                  {pollOptions.length > MIN_POLL_OPTIONS && (
                    <TouchableOpacity onPress={() => removePollOption(index)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              {pollOptions.length < MAX_POLL_OPTIONS && (
                <TouchableOpacity style={[styles.addOptionBtn, { borderColor: colors.border }]} onPress={addPollOption}>
                  <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                  <Text style={[styles.addOptionText, { color: colors.primary }]}>Add option</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </ScrollView>

        {/* Mention search dropdown */}
        {showMentionSearch && (
          <View style={[styles.mentionDropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {isMentionLoading ? (
              <View style={styles.mentionLoading}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : mentionUsers.length > 0 ? (
              <FlatList
                data={mentionUsers.slice(0, 5)}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => {
                  const name = item.profile?.display_name || item.username || item.email?.split("@")[0] || "";
                  return (
                    <TouchableOpacity
                      style={[styles.mentionItem, { borderBottomColor: colors.border }]}
                      onPress={() => insertMention(item)}
                    >
                      <Avatar uri={item.profile?.avatar_url || item.avatar_url} name={name} size="sm" />
                      <View style={styles.mentionInfo}>
                        <Text style={[styles.mentionName, { color: colors.textPrimary }]} numberOfLines={1}>{name}</Text>
                        <Text style={[styles.mentionHandle, { color: colors.textSecondary }]} numberOfLines={1}>
                          @{item.username || item.email?.split("@")[0]}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            ) : (
              <View style={styles.mentionEmpty}>
                <Text style={[styles.mentionEmptyText, { color: colors.textSecondary }]}>No users found</Text>
              </View>
            )}
          </View>
        )}
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  headerBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { fontSize: fontSize.lg, fontWeight: "600" },
  postBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  postBtnText: { fontSize: fontSize.sm, fontWeight: "600" },
  content: { flex: 1 },
  inputSection: {
    flexDirection: "row",
    padding: spacing.lg,
    gap: spacing.md,
  },
  inputWrapper: { flex: 1 },
  inputContainer: { position: "relative", minHeight: 120 },
  inputOverlay: {
    fontSize: fontSize.lg,
    lineHeight: 24,
    minHeight: 120,
  },
  inputTransparent: {
    color: "transparent",
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  userName: { fontSize: fontSize.md, fontWeight: "600", marginBottom: spacing.xs },
  input: {
    fontSize: fontSize.lg,
    minHeight: 120,
    textAlignVertical: "top",
    lineHeight: 24,
  },
  charCounter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  charBar: { width: 40, height: 3, borderRadius: 2, overflow: "hidden" },
  charBarFill: { height: "100%", borderRadius: 2 },
  charText: { fontSize: fontSize.xs },
  mediaPreview: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
    overflow: "hidden",
    height: 200,
  },
  mediaImage: { width: "100%", height: "100%" },
  mediaRemove: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  mediaBadge: {
    position: "absolute",
    bottom: spacing.sm,
    left: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  mediaBadgeText: { color: "#fff", fontSize: fontSize.xs, fontWeight: "600" },
  documentPreview: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    gap: spacing.sm,
  },
  documentName: { flex: 1, fontSize: fontSize.sm },
  section: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  sectionLabel: { fontSize: fontSize.sm, fontWeight: "500" },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.sm,
  },
  switchLabel: { fontSize: fontSize.sm, fontWeight: "500" },
  pollOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  pollDot: { width: 8, height: 8, borderRadius: 4 },
  pollInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.sm,
  },
  addOptionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: borderRadius.md,
  },
  addOptionText: { fontSize: fontSize.sm, fontWeight: "500" },
  mentionDropdown: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: 220,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    overflow: "hidden",
  },
  mentionLoading: { padding: spacing.lg, alignItems: "center" },
  mentionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  mentionInfo: { flex: 1 },
  mentionName: { fontSize: fontSize.sm, fontWeight: "600" },
  mentionHandle: { fontSize: fontSize.xs },
  mentionEmpty: { padding: spacing.lg, alignItems: "center" },
  mentionEmptyText: { fontSize: fontSize.sm },
  toolbar: {
    flexDirection: "row",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    gap: spacing.xs,
  },
  toolButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: borderRadius.md,
  },
});
