import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  Pressable,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { api } from "../../lib/api-client";
import { useAuth } from "../../hooks/useAuth";
import { useTheme } from "../../lib/theme-context";
import { Avatar } from "../../components/Avatar";
import { PostMenu } from "../../components/PostMenu";
import { PollView } from "../../components/PollView";
import { MediaGallery } from "../../components/MediaGallery";
import { ReportSheet } from "../../components/ReportSheet";
import { Ionicons } from "@expo/vector-icons";
import { spacing, fontSize, borderRadius } from "../../lib/theme";
import type { Post, Comment, User } from "../../types";

function getRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return date.toLocaleDateString();
}

const ROLE_ICONS: Record<string, { name: string; color: string }> = {
  admin: { name: "checkmark-circle", color: "#0ea5e9" },
  moderator: { name: "shield", color: "#8b5cf6" },
  student: { name: "book", color: "#6b7280" },
  university_staff: { name: "school", color: "#f59e0b" },
};

function CommentItem({
  comment,
  depth,
  colors,
  userId,
  onReply,
  onReport,
  onEdit,
  onDelete,
}: {
  comment: Comment;
  depth: number;
  colors: any;
  userId?: string;
  onReply: (commentId: string, authorName: string, content: string, username: string) => void;
  onReport: (commentId: string) => void;
  onEdit: (commentId: string, content: string) => void;
  onDelete: (commentId: string) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const maxDepth = 2;
  const authorName = comment.author.profile?.display_name || comment.author.email;
  const authorAvatar = comment.author.profile?.avatar_url;
  const roleIcon = ROLE_ICONS[comment.author.role];
  const isOwner = userId === comment.author.id;

  return (
    <View>
      <View
        style={[
          styles.comment,
          depth > 0 && {
            marginLeft: depth * 24,
            borderLeftWidth: 2,
            borderLeftColor: colors.border,
            paddingLeft: 12,
          },
        ]}
      >
        <Avatar uri={authorAvatar} name={authorName} size="sm" />
        <View style={styles.commentContent}>
          <View style={styles.commentHeader}>
            <Text style={[styles.commentAuthor, { color: colors.textPrimary }]} numberOfLines={1}>
              {authorName}
            </Text>
            {roleIcon && <Ionicons name={roleIcon.name as any} size={12} color={roleIcon.color} />}
            {comment.author.username && (
              <Text style={[styles.commentUsername, { color: colors.textTertiary }]}>
                @{comment.author.username}
              </Text>
            )}
            <Text style={[styles.commentDot, { color: colors.textSecondary }]}>·</Text>
            <Text style={[styles.commentTime, { color: colors.textSecondary }]}>
              {getRelativeTime(comment.created_at)}
              {comment.edited_at ? " · Edited" : ""}
            </Text>
            <TouchableOpacity
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              onPress={() => setShowMenu(true)}
              style={{ paddingHorizontal: 4, paddingVertical: 4 }}
            >
              <Ionicons name="ellipsis-horizontal" size={14} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.commentText, { color: colors.textPrimary }]}>
            {comment.content.split(/(#\w+|(?<!@)@[\w.]+)/g).map((part, i) =>
              part.startsWith("#") ? (
                <Text key={i} style={{ color: colors.primary, fontWeight: "500" }}>{part}</Text>
              ) : part.startsWith("@") && !part.startsWith("@@") ? (
                <Text key={i} style={{ color: "#ef4444", fontWeight: "500" }}>{part}</Text>
              ) : (
                <Text key={i}>{part}</Text>
              )
            )}
          </Text>
          {depth < maxDepth && (
            <TouchableOpacity
              style={styles.replyBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={() => onReply(comment.id, authorName, comment.content, comment.author.username || "")}
            >
              <Text style={[styles.replyBtnText, { color: colors.primary }]}>Reply</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setShowMenu(false)}>
          <View style={[styles.commentMenuModal, { backgroundColor: colors.card }]}>
            {isOwner ? (
              <>
                <TouchableOpacity
                  style={styles.commentMenuItemModal}
                  activeOpacity={0.6}
                  onPress={() => { setShowMenu(false); onEdit(comment.id, comment.content); }}
                >
                  <Ionicons name="pencil-outline" size={18} color={colors.textPrimary} />
                  <Text style={[styles.commentMenuTextModal, { color: colors.textPrimary }]}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.commentMenuItemModal}
                  activeOpacity={0.6}
                  onPress={() => { setShowMenu(false); onDelete(comment.id); }}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.error} />
                  <Text style={[styles.commentMenuTextModal, { color: colors.error }]}>Delete</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={styles.commentMenuItemModal}
                activeOpacity={0.6}
                onPress={() => { setShowMenu(false); onReport(comment.id); }}
              >
                <Ionicons name="flag-outline" size={18} color={colors.error} />
                <Text style={[styles.commentMenuTextModal, { color: colors.error }]}>Report</Text>
              </TouchableOpacity>
            )}
          </View>
        </Pressable>
      </Modal>

      {comment.replies?.map((reply) => (
        <CommentItem
          key={reply.id}
          comment={reply}
          depth={depth + 1}
          colors={colors}
          userId={userId}
          onReply={onReply}
          onReport={onReport}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </View>
  );
}

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState("");
  const [replyingTo, setReplyingTo] = useState<{ id: string; name: string; content: string } | null>(null);
  const [replyText, setReplyText] = useState("");
  const [reportCommentId, setReportCommentId] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState<{ id: string; content: string } | null>(null);
  const [editText, setEditText] = useState("");
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  // Mention search state
  const [mentionQuery, setMentionQuery] = useState("");
  const [showMentionSearch, setShowMentionSearch] = useState(false);
  const [mentionSearchPosition, setMentionSearchPosition] = useState(0);

  const { data: mentionResults, isLoading: isMentionLoading } = useQuery({
    queryKey: ["userSearch", mentionQuery],
    queryFn: () => api.get<{ users: User[] }>("/search", { params: { q: mentionQuery } }),
    enabled: mentionQuery.length >= 2,
  });

  const mentionUsers = mentionResults?.users || [];

  const { data: post, refetch, isRefetching } = useQuery({
    queryKey: ["post", id],
    queryFn: () => api.get<Post>(`/posts/${id}`),
    enabled: !!id,
  });

  const { data: commentsData } = useQuery({
    queryKey: ["comments", id],
    queryFn: () => api.get<Comment[]>(`/posts/${id}/comments`),
    enabled: !!id,
  });

  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [isSaved, setIsSaved] = useState(false);
  const [shareCount, setShareCount] = useState(0);
  const [isShared, setIsShared] = useState(false);

  React.useEffect(() => {
    if (post) {
      setIsLiked(post.is_liked);
      setLikesCount(post.like_count ?? 0);
      setIsSaved(post.is_saved || false);
      setShareCount(post.share_count ?? 0);
      setIsShared(post.is_reposted || false);
    }
  }, [post?.id, post?.like_count, post?.is_liked, post?.is_saved]);

  const likeMutation = useMutation({
    mutationFn: () => isLiked ? api.delete(`/posts/${id}/like`) : api.post(`/posts/${id}/like`),
    onMutate: () => {
      setIsLiked(!isLiked);
      setLikesCount((c) => (isLiked ? c - 1 : c + 1));
    },
    onError: () => {
      setIsLiked(isLiked);
      setLikesCount(post?.like_count ?? 0);
    },
  });

  const saveMutation = useMutation({
    mutationFn: () => isSaved ? api.delete(`/posts/${id}/save`) : api.post(`/posts/${id}/save`),
    onMutate: () => setIsSaved(!isSaved),
    onError: () => setIsSaved(isSaved),
  });

  const shareMutation = useMutation({
    mutationFn: () => isShared ? api.delete(`/posts/${id}/share`) : api.post(`/posts/${id}/share`),
    onMutate: () => {
      setIsShared(!isShared);
      setShareCount((c) => (isShared ? c - 1 : c + 1));
    },
    onError: () => {
      setIsShared(isShared);
      setShareCount(post?.share_count ?? 0);
    },
  });

  const commentMutation = useMutation({
    mutationFn: (payload: { content: string; parent_id?: string }) =>
      api.post(`/posts/${id}/comments`, payload),
    onSuccess: () => {
      setCommentText("");
      setReplyText("");
      setReplyingTo(null);
      queryClient.invalidateQueries({ queryKey: ["comments", id] });
    },
  });

  const editCommentMutation = useMutation({
    mutationFn: ({ commentId, content }: { commentId: string; content: string }) =>
      api.patch(`/posts/${id}/comments/${commentId}`, { content }),
    onSuccess: () => {
      setEditingComment(null);
      setEditText("");
      queryClient.invalidateQueries({ queryKey: ["comments", id] });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) =>
      api.delete(`/posts/${id}/comments/${commentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", id] });
    },
  });

  const comments = useMemo(() => {
    const items = Array.isArray(commentsData) ? commentsData : [];
    return items.filter((c) => !c.parent_id);
  }, [commentsData]);

  const totalCount = useMemo(() => {
    const count = (list: Comment[]): number =>
      list.reduce((n, c) => n + 1 + count(c.replies || []), 0);
    return count(comments);
  }, [comments]);

  const handleReply = (commentId: string, authorName: string, content: string, username: string) => {
    setReplyingTo({ id: commentId, name: authorName, content });
    setReplyText(`@${username} `);
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
      inputRef.current?.focus();
    }, 150);
  };

  const handleSendReply = () => {
    if (!replyText.trim() || !replyingTo) return;
    commentMutation.mutate({ content: replyText.trim(), parent_id: replyingTo.id });
  };

  const handleCommentMention = (text: string, setter: (t: string) => void) => {
    setter(text);
    const cursorPos = text.length;
    const lastAtIndex = text.lastIndexOf("@", cursorPos - 1);
    if (lastAtIndex >= 0) {
      if (lastAtIndex > 0 && text[lastAtIndex - 1] === "@") {
        setShowMentionSearch(false);
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
  };

  const insertCommentMention = (selectedUser: User, text: string, setter: (t: string) => void) => {
    const username = selectedUser.username || selectedUser.email?.split("@")[0] || "";
    const beforeAt = text.slice(0, mentionSearchPosition);
    const afterCursor = text.slice(mentionSearchPosition + mentionQuery.length + 1);
    setter(`${beforeAt}@${username} ${afterCursor}`);
    setShowMentionSearch(false);
    setMentionQuery("");
    inputRef.current?.focus();
  };

  const handleSendComment = () => {
    if (!commentText.trim()) return;
    commentMutation.mutate({ content: commentText.trim() });
  };

  const handleReportComment = (commentId: string) => {
    setReportCommentId(commentId);
  };

  const handleEditComment = (commentId: string, content: string) => {
    setEditingComment({ id: commentId, content });
    setEditText(content);
  };

  const handleDeleteComment = (commentId: string) => {
    Alert.alert("Delete Comment", "Are you sure you want to delete this comment?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteCommentMutation.mutate(commentId) },
    ]);
  };

  if (!post) return null;

  const authorName = post.author.profile?.display_name || post.author.email;
  const authorAvatar = post.author.profile?.avatar_url;
  const isAuthor = user?.id === post.author.id;
  const roleIcon = ROLE_ICONS[post.author.role];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Post</Text>
        <PostMenu
          postId={post.id}
          authorId={post.author.id}
          content={post.content}
          isAuthor={isAuthor}
          onDeleted={() => router.back()}
        />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={50}
      >
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.postHeader}>
            <TouchableOpacity
              onPress={() => router.push(`/profile/${post.author.id}`)}
              style={styles.authorInfo}
            >
              <Avatar uri={authorAvatar} name={authorName} size="md" />
              <View>
                <View style={styles.nameRow}>
                  <Text style={[styles.authorName, { color: colors.textPrimary }]}>{authorName}</Text>
                  {roleIcon && <Ionicons name={roleIcon.name as any} size={13} color={roleIcon.color} />}
                  {post.author.username && (
                    <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
                      @{post.author.username}
                    </Text>
                  )}
                </View>
                <Text style={[styles.time, { color: colors.textSecondary }]}>
                  {getRelativeTime(post.created_at)}
                  {post.edited_at ? " · Edited" : ""}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          <Text style={[styles.content, { color: colors.textPrimary }]}>
            {post.mentioned_users && post.mentioned_users.length > 0
              ? post.content.split(/(#\w+|(?<!@)@[\w.]+)/g).map((part, i) =>
                  part.startsWith("#") ? (
                    <Text key={i} style={{ color: colors.primary, fontWeight: "500" }}>
                      {part}
                    </Text>
                  ) : part.startsWith("@") && !part.startsWith("@@") ? (
                    <Text key={i} style={{ color: "#ef4444", fontWeight: "500" }}>
                      {part}
                    </Text>
                  ) : (
                    <Text key={i}>{part}</Text>
                  )
                )
              : post.content.split(/(#\w+)/g).map((part, i) =>
                  part.startsWith("#") ? (
                    <Text key={i} style={{ color: colors.primary, fontWeight: "500" }}>
                      {part}
                    </Text>
                  ) : (
                    <Text key={i}>{part}</Text>
                  )
                )}
          </Text>

          {post.media && post.media.length > 0 && (
            <View style={{ marginHorizontal: 16, marginTop: 8 }}>
              <MediaGallery media={post.media} />
            </View>
          )}

          {post.poll && post.poll.options.length > 0 && (
            <View style={{ paddingHorizontal: 16 }}>
              <PollView postId={post.id} poll={post.poll} />
            </View>
          )}

          <View style={[styles.interactions, { borderBottomColor: colors.border, borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.interactionBtn, isLiked && { backgroundColor: colors.like + "10" }]}
              onPress={() => likeMutation.mutate()}
            >
              <Ionicons name={isLiked ? "heart" : "heart-outline"} size={18} color={isLiked ? colors.like : colors.textSecondary} />
              <Text style={[styles.interactionCount, { color: isLiked ? colors.like : colors.textSecondary }]}>{likesCount}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.interactionBtn}>
              <Ionicons name="chatbubble-outline" size={18} color={colors.textSecondary} />
              <Text style={[styles.interactionCount, { color: colors.textSecondary }]}>{totalCount}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.interactionBtn, isShared && { backgroundColor: colors.success + "15" }]}
              onPress={() => shareMutation.mutate()}
            >
              <Ionicons name={isShared ? "repeat" : "repeat-outline"} size={18} color={isShared ? colors.success : colors.textSecondary} />
              <Text style={[styles.interactionCount, { color: isShared ? colors.success : colors.textSecondary }]}>{shareCount}</Text>
            </TouchableOpacity>

            <View style={styles.interactionSpacer} />

            <TouchableOpacity
              style={[styles.interactionBtn, isSaved && { backgroundColor: colors.primary + "10" }]}
              onPress={() => saveMutation.mutate()}
            >
              <Ionicons name={isSaved ? "bookmark" : "bookmark-outline"} size={18} color={isSaved ? colors.primary : colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.commentsSection}>
            {comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                depth={0}
                colors={colors}
                userId={user?.id}
                onReply={handleReply}
                onReport={handleReportComment}
                onEdit={handleEditComment}
                onDelete={handleDeleteComment}
              />
            ))}

            {comments.length === 0 && (
              <View style={styles.emptyComments}>
                <Ionicons name="chatbubble-outline" size={32} color={colors.textTertiary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No comments yet</Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Fixed bottom input bar */}
        <View style={[styles.inputBar, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
          {editingComment && (
            <View style={[styles.replyBanner, { backgroundColor: colors.card }]}>
              <View style={[styles.replyQuote, { borderLeftColor: colors.warning }]}>
                <Text style={[styles.replyQuoteName, { color: colors.textSecondary }]} numberOfLines={1}>
                  Editing comment
                </Text>
                <Text style={[styles.replyQuoteText, { color: colors.textSecondary }]} numberOfLines={2}>
                  {editingComment.content}
                </Text>
              </View>
              <TouchableOpacity onPress={() => { setEditingComment(null); setEditText(""); }} style={styles.replyCloseBtn}>
                <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}
          {replyingTo && !editingComment && (
            <View style={[styles.replyBanner, { backgroundColor: colors.card }]}>
              <View style={[styles.replyQuote, { borderLeftColor: colors.primary }]}>
                <Text style={[styles.replyQuoteName, { color: colors.textSecondary }]} numberOfLines={1}>
                  {replyingTo.name}
                </Text>
                <Text style={[styles.replyQuoteText, { color: colors.textSecondary }]} numberOfLines={2}>
                  {replyingTo.content}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setReplyingTo(null)} style={styles.replyCloseBtn}>
                <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.inputRow}>
            <Avatar uri={user?.profile?.avatar_url} name={user?.profile?.display_name || user?.email || "U"} size="sm" />
            <TextInput
              ref={inputRef}
              style={[styles.mainInput, { color: colors.textPrimary, backgroundColor: colors.muted, borderColor: colors.border }]}
              placeholder={editingComment ? "Edit your comment..." : replyingTo ? `Reply to ${replyingTo.name}...` : "Write a comment..."}
              placeholderTextColor={colors.textSecondary}
              value={editingComment ? editText : replyingTo ? replyText : commentText}
              onChangeText={(text) => {
                if (editingComment) {
                  setEditText(text);
                } else if (replyingTo) {
                  handleCommentMention(text, setReplyText);
                } else {
                  handleCommentMention(text, setCommentText);
                }
              }}
              multiline
            />
            <TouchableOpacity
              style={styles.atBtn}
              onPress={() => {
                const text = editingComment ? editText : replyingTo ? replyText : commentText;
                const setter = editingComment ? setEditText : replyingTo ? setReplyText : setCommentText;
                const newText = text + "@";
                setter(newText);
                setMentionSearchPosition(text.length);
                setMentionQuery("");
                setShowMentionSearch(true);
                inputRef.current?.focus();
              }}
            >
              <Ionicons name="at" size={18} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.sendBtn,
                {
                  backgroundColor: (editingComment ? editText.trim() : replyingTo ? replyText.trim() : commentText.trim())
                    ? colors.primary
                    : colors.muted,
                },
              ]}
              disabled={
                editCommentMutation.isPending ||
                commentMutation.isPending ||
                !(editingComment ? editText.trim() : replyingTo ? replyText.trim() : commentText.trim())
              }
              onPress={
                editingComment
                  ? () => editCommentMutation.mutate({ commentId: editingComment.id, content: editText.trim() })
                  : replyingTo
                  ? handleSendReply
                  : handleSendComment
              }
            >
              <Ionicons name="send" size={16} color="#fff" />
            </TouchableOpacity>
          </View>

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
                    const currentText = editingComment ? editText : replyingTo ? replyText : commentText;
                    const setter = editingComment ? setEditText : replyingTo ? setReplyText : setCommentText;
                    return (
                      <TouchableOpacity
                        style={[styles.mentionItem, { borderBottomColor: colors.border }]}
                        onPress={() => insertCommentMention(item, currentText, setter)}
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
        </View>
      </KeyboardAvoidingView>

      <ReportSheet
        open={!!reportCommentId}
        targetType="comment"
        targetId={reportCommentId || ""}
        onClose={() => setReportCommentId(null)}
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
  headerTitle: { fontSize: 17, fontWeight: "600" },
  scrollContent: { paddingBottom: 8 },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  authorInfo: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  authorName: { fontSize: 15, fontWeight: "600" },
  time: { fontSize: 13 },
  content: { fontSize: 15, lineHeight: 22, paddingHorizontal: 16, paddingBottom: 12 },
  mediaContainer: { marginHorizontal: 16, marginBottom: 12, borderRadius: 12, overflow: "hidden", position: "relative" },
  media: { width: "100%", height: 240 },
  mediaBadge: { position: "absolute", bottom: 8, right: 8, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  mediaBadgeText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  interactions: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 16,
  },
  interactionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9999,
  },
  interactionCount: { fontSize: 13, fontWeight: "500" },
  interactionSpacer: { flex: 1 },
  commentsSection: { paddingTop: 8 },
  comment: { flexDirection: "row", paddingVertical: 10, paddingHorizontal: 16, gap: 10 },
  commentContent: { flex: 1 },
  commentHeader: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 2 },
  commentAuthor: { fontSize: 13, fontWeight: "600" },
  commentUsername: { fontSize: 12, marginLeft: 4 },
  commentDot: { fontSize: 13 },
  commentTime: { fontSize: 12 },
  commentText: { fontSize: 14, lineHeight: 20 },
  commentActions: { flexDirection: "row", gap: 12, marginTop: 4 },
  replyBtn: { marginTop: 4 },
  replyBtnText: { fontSize: 12, fontWeight: "600" },
  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  commentMenuModal: {
    borderRadius: 12,
    minWidth: 160,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  commentMenuItemModal: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  commentMenuTextModal: { fontSize: 15, fontWeight: "500" },
  inputBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  replyBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
    borderRadius: 8,
  },
  replyQuote: {
    flex: 1,
    borderLeftWidth: 3,
    paddingLeft: 8,
  },
  replyQuoteName: { fontSize: 12, fontWeight: "600", marginBottom: 2 },
  replyQuoteText: { fontSize: 13, lineHeight: 18 },
  replyCloseBtn: { paddingTop: 2 },
  mentionDropdown: {
    maxHeight: 200,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    overflow: "hidden",
    marginTop: spacing.xs,
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
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingTop: 10,
  },
  mainInput: {
    flex: 1,
    fontSize: 15,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxHeight: 100,
  },
  atBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyComments: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 14 },
});
