import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Avatar } from "./Avatar";
import { PostMenu } from "./PostMenu";
import { PollView } from "./PollView";
import { MediaGallery } from "./MediaGallery";
import { api } from "../lib/api-client";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../lib/theme-context";
import { spacing, fontSize } from "../lib/theme";
import type { Post } from "../types";

interface PostCardProps {
  post: Post;
  onDelete?: (id: string) => void;
}

function getRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return date.toLocaleDateString();
}

const ROLE_ICONS: Record<string, { name: string; color: string }> = {
  admin: { name: "checkmark-circle", color: "#0ea5e9" },
  moderator: { name: "shield", color: "#8b5cf6" },
  club_admin: { name: "shield-check", color: "#10b981" },
  student: { name: "book", color: "#6b7280" },
  university_staff: { name: "school", color: "#f59e0b" },
};

export function PostCard({ post, onDelete }: PostCardProps) {
  const { user } = useAuth();
  const { colors } = useTheme();

  if (!post.author) return null;

  const isAuthor = user?.id === post.author.id;

  const [isLiked, setIsLiked] = useState(post.is_liked);
  const [likesCount, setLikesCount] = useState(post.like_count ?? 0);
  const [isSaved, setIsSaved] = useState(post.is_saved || false);
  const [isShared, setIsShared] = useState(post.is_reposted || false);
  const [shareCount, setShareCount] = useState(post.share_count ?? 0);

  const handleLike = async () => {
    const prev = isLiked;
    const prevCount = likesCount;
    setIsLiked(!prev);
    setLikesCount((c) => (prev ? c - 1 : c + 1));
    try {
      if (prev) await api.delete(`/posts/${post.id}/like`);
      else await api.post(`/posts/${post.id}/like`);
    } catch {
      setIsLiked(prev);
      setLikesCount(prevCount);
    }
  };

  const handleSave = async () => {
    const prev = isSaved;
    setIsSaved(!prev);
    try {
      if (prev) await api.delete(`/posts/${post.id}/save`);
      else await api.post(`/posts/${post.id}/save`);
    } catch {
      setIsSaved(prev);
    }
  };

  const handleShare = async () => {
    const prev = isShared;
    setIsShared(!prev);
    setShareCount((c) => (prev ? c - 1 : c + 1));
    try {
      if (prev) await api.delete(`/posts/${post.id}/share`);
      else await api.post(`/posts/${post.id}/share`);
    } catch {
      setIsShared(prev);
      setShareCount((c) => (prev ? c + 1 : c - 1));
    }
  };

  return (
    <View style={[styles.card, { borderBottomColor: colors.border }]}>
      <View style={styles.row}>
        {/* Avatar — 40px */}
        <TouchableOpacity onPress={() => router.push(`/profile/${post.author.id}`)} activeOpacity={0.7}>
          <Avatar uri={post.author.profile?.avatar_url} name={post.author.profile?.display_name || post.author.email} size="md" />
        </TouchableOpacity>

        {/* Content column */}
        <View style={styles.contentCol}>
          {/* Header row — name · time */}
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.push(`/profile/${post.author.id}`)} activeOpacity={0.7}>
              <Text style={[styles.authorName, { color: colors.textPrimary }]} numberOfLines={1}>
                {post.author.profile?.display_name || post.author.email}
              </Text>
            </TouchableOpacity>
            {(() => {
              const roleIcon = ROLE_ICONS[post.author.role];
              if (!roleIcon) return null;
              return <Ionicons name={roleIcon.name as any} size={13} color={roleIcon.color} />;
            })()}
            {post.author.username && (
              <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
                @{post.author.username}
              </Text>
            )}
            <Text style={[styles.dot, { color: colors.textSecondary }]}>·</Text>
            <Text style={[styles.timestamp, { color: colors.textSecondary }]}>
              {getRelativeTime(post.created_at)}
            </Text>
            {post.edited_at && (
              <Text style={[styles.timestamp, { color: colors.textSecondary }]}>· Edited</Text>
            )}
            {post.faculty_only && (
              <Ionicons name="lock-closed" size={12} color={colors.primary} />
            )}
            <View style={styles.menuSpacer} />
            <PostMenu
              postId={post.id}
              authorId={post.author.id}
              content={post.content}
              isAuthor={isAuthor}
              onDeleted={onDelete || (() => {})}
            />
          </View>

          {/* Post content — 15px */}
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

          {/* Media */}
          {post.media && post.media.length > 0 && (
            <MediaGallery media={post.media} />
          )}

          {/* Poll */}
          {post.poll && post.poll.options.length > 0 && (
            <PollView postId={post.id} poll={post.poll} />
          )}

          {/* Action bar — mt-3, gap-6 */}
          <View style={styles.actions}>
            {/* Comment */}
            <TouchableOpacity
              style={styles.actionBtn}
              activeOpacity={0.6}
              onPress={() => router.push(`/post/${post.id}`)}
            >
              <Ionicons name="chatbubble-outline" size={18} color={colors.textSecondary} />
              <Text style={[styles.actionCount, { color: colors.textSecondary }]}>{post.comment_count}</Text>
            </TouchableOpacity>

            {/* Repost */}
            <TouchableOpacity
              style={[styles.actionBtn, isShared && { backgroundColor: colors.success + "15" }]}
              activeOpacity={0.6}
              onPress={handleShare}
            >
              <Ionicons name={isShared ? "repeat" : "repeat-outline"} size={18} color={isShared ? colors.success : colors.textSecondary} />
              <Text style={[styles.actionCount, { color: isShared ? colors.success : colors.textSecondary }]}>{shareCount}</Text>
            </TouchableOpacity>

            {/* Like */}
            <TouchableOpacity
              style={[styles.actionBtn, isLiked && { backgroundColor: colors.like + "10" }]}
              activeOpacity={0.6}
              onPress={handleLike}
            >
              <Ionicons
                name={isLiked ? "heart" : "heart-outline"}
                size={18}
                color={isLiked ? colors.like : colors.textSecondary}
              />
              <Text style={[styles.actionCount, { color: isLiked ? colors.like : colors.textSecondary }]}>
                {likesCount}
              </Text>
            </TouchableOpacity>

            {/* Bookmark */}
            <TouchableOpacity
              style={[styles.actionBtn, isSaved && { backgroundColor: colors.primary + "10" }]}
              activeOpacity={0.6}
              onPress={handleSave}
            >
              <Ionicons
                name={isSaved ? "bookmark" : "bookmark-outline"}
                size={18}
                color={isSaved ? colors.primary : colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  contentCol: {
    flex: 1,
    minWidth: 0,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  authorName: {
    fontSize: 14,
    fontWeight: "600",
  },
  dot: {
    fontSize: 13,
  },
  timestamp: {
    fontSize: 13,
  },
  menuSpacer: {
    flex: 1,
  },
  content: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 4,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    marginTop: 12,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
  },
  actionCount: {
    fontSize: 13,
  },
});
