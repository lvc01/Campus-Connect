"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Bookmark,
  Heart,
  Link2,
  Lock,
  MessageCircle,
  MoreHorizontal,
  PenLine,
  Share2,
  Trash2,
  Zap,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { IconButton } from "@/components/ui/icon-button";
import { IconTextButton } from "@/components/ui/icon-text-button";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { apiClient } from "@/lib/api-client";
import { cn, getRelativeTimeShort } from "@/lib/utils";
import { CommentSection } from "./comment-section";
import { ReportModal } from "./report-modal";
import type { PostData } from "@/types/post";

export interface PostCardProps {
  post: PostData;
  currentUserId?: string;
  onEdit?: (post: PostData) => void;
  onDelete?: (postId: string) => void;
}

const parseContentWithHashtags = (text: string | null) => {
  if (!text) return null;
  return text.split(/(\s+)/).map((part, index) => {
    if (part.startsWith("#") && part.length > 1) {
      return (
        <span key={index} className="text-accent font-medium cursor-pointer hover:underline">
          {part}
        </span>
      );
    }
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
};

export const PostCard: React.FC<PostCardProps> = ({
  post,
  currentUserId,
  onEdit,
  onDelete,
}) => {
  const [isLiked, setIsLiked] = useState(post.is_liked);
  const [likesCount, setLikesCount] = useState(post.like_count);
  const [isSaved, setIsSaved] = useState(post.is_saved);
  const [commentCount, setCommentCount] = useState(post.comment_count);
  const [shareCount, setShareCount] = useState(post.share_count || 0);
  const [showComments, setShowComments] = useState(false);
  const [likeAnimating, setLikeAnimating] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [isBoosted, setIsBoosted] = useState(post.is_promoted);
  const [boostLoading, setBoostLoading] = useState(false);

  const isAuthor = !!currentUserId && post.author?.id === currentUserId;
  const authorName = post.author?.profile?.display_name || "Student";
  const handle = post.author?.email?.split("@")[0] || "user";
  const profileHref = `/profile/${post.author.id}`;

  const handleLike = async () => {
    const originalLike = isLiked;
    setIsLiked(!originalLike);
    setLikesCount((prev) => (originalLike ? prev - 1 : prev + 1));
    if (!originalLike) {
      setLikeAnimating(true);
      window.setTimeout(() => setLikeAnimating(false), 450);
    }
    try {
      if (originalLike) await apiClient.delete(`/posts/${post.id}/like`);
      else await apiClient.post(`/posts/${post.id}/like`);
    } catch {
      setIsLiked(originalLike);
      setLikesCount((prev) => (originalLike ? prev + 1 : prev - 1));
    }
  };

  const handleSave = async () => {
    const originalSave = isSaved;
    setIsSaved(!originalSave);
    try {
      if (originalSave) await apiClient.delete(`/posts/${post.id}/save`);
      else await apiClient.post(`/posts/${post.id}/save`);
    } catch {
      setIsSaved(originalSave);
    }
  };

  const handleShare = async () => {
    const originalCount = shareCount;
    setShareCount((prev) => prev + 1);
    try {
      await apiClient.post(`/posts/${post.id}/share`);
    } catch {
      setShareCount(originalCount);
    }
  };

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/posts/${post.id}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // best-effort; clipboard access can be blocked
    }
  };

  const handleBoost = async () => {
    if (isBoosted || boostLoading) return;
    setBoostLoading(true);
    try {
      await apiClient.post("/ads", {
        title: `Boosted: ${post.content?.slice(0, 80) || "Post"}`,
        content: post.content?.slice(0, 200) || null,
        boosted_post_id: post.id,
        total_budget: 1000,
        daily_budget: 100,
      });
      setIsBoosted(true);
    } catch (err) {
      console.error("Failed to boost post", err);
    } finally {
      setBoostLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this post?")) return;
    try {
      await apiClient.delete(`/posts/${post.id}`);
      onDelete?.(post.id);
    } catch (err) {
      console.error("Failed to delete post", err);
    }
  };

  const menuItems: MenuItem[] = [];
  if (isAuthor) {
    menuItems.push({
      key: "edit",
      label: "Edit post",
      icon: <PenLine size={16} />,
      onSelect: () => onEdit?.(post),
    });
    menuItems.push({
      key: "boost",
      label: isBoosted ? "Promoted" : boostLoading ? "Boosting..." : "Boost post",
      icon: <Zap size={16} />,
      onSelect: handleBoost,
      disabled: isBoosted || boostLoading,
    });
    menuItems.push({
      key: "delete",
      label: "Delete post",
      icon: <Trash2 size={16} />,
      onSelect: handleDelete,
      destructive: true,
    });
  }
  menuItems.push({
    key: "report",
    label: "Report post",
    icon: <Link2 size={16} />,
    onSelect: () => setShowReportModal(true),
  });

  return (
    <article className="border-b border-border">
      <div className="px-6 py-4 hover:bg-bg-elevated/40 transition-colors">
        <div className="flex gap-3">
          <Link href={profileHref} className="shrink-0 mt-0.5">
            <Avatar
              user={{ name: authorName, profile: { avatar_url: post.author?.profile?.avatar_url } }}
              size={40}
            />
          </Link>

          <div className="flex-1 min-w-0">
            {/* Header row */}
            <div className="flex items-center gap-1.5 min-w-0">
              <Link
                href={profileHref}
                className="text-sm font-semibold text-text-primary hover:underline truncate"
              >
                {authorName}
              </Link>
              <span className="text-sm text-text-secondary truncate shrink-0">
                @{handle}
              </span>
              <span className="text-text-tertiary shrink-0">·</span>
              <span className="text-sm text-text-secondary hover:underline cursor-pointer whitespace-nowrap shrink-0">
                {getRelativeTimeShort(post.created_at)}
              </span>
              {post.visibility === "faculty_only" && (
                <Lock
                  size={12}
                  className="text-text-tertiary shrink-0 ml-0.5"
                  aria-label="Faculty-only post"
                />
              )}
              <div className="ml-auto shrink-0">
                <Menu
                  trigger={
                    <MoreHorizontal
                      size={16}
                      className="text-text-tertiary hover:text-text-secondary"
                      aria-label="Post actions"
                    />
                  }
                  items={menuItems}
                />
              </div>
            </div>

            {/* Post text */}
            <div className="mt-1 text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
              {parseContentWithHashtags(post.content)}
            </div>

            {/* Media */}
            {post.media && post.media.length > 0 && (
              <div className="mt-3 rounded-lg overflow-hidden border border-border">
                {post.media[0].media_type === "video" ? (
                  <video
                    src={post.media[0].url}
                    controls
                    className="w-full h-auto max-h-[400px] object-cover bg-black"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={post.media[0].url}
                    alt="Media"
                    className="w-full h-auto max-h-[400px] object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                )}
              </div>
            )}

            {/* Action bar */}
            <div className="flex items-center justify-between max-w-[400px] mt-3 select-none">
              <IconTextButton
                icon={<MessageCircle size={18} />}
                count={commentCount}
                label="Reply"
                tone="accent"
                onClick={() => setShowComments((v) => !v)}
              />
              <IconTextButton
                icon={<Share2 size={18} />}
                count={shareCount}
                label="Repost"
                tone="repost"
                onClick={handleShare}
              />
              <IconTextButton
                icon={
                  <span
                    className={cn(
                      "inline-block transition-transform duration-300",
                      likeAnimating && "scale-125",
                    )}
                  >
                    <Heart
                      size={18}
                      fill={isLiked ? "currentColor" : "none"}
                    />
                  </span>
                }
                count={likesCount}
                label="Like"
                tone="like"
                active={isLiked}
                onClick={handleLike}
              />
              <IconButton
                icon={
                  <Bookmark
                    size={18}
                    fill={isSaved ? "currentColor" : "none"}
                  />
                }
                label="Save"
                active={isSaved}
                activeColorClass="text-accent"
                onClick={handleSave}
              />
              <IconButton
                icon={<Link2 size={18} />}
                label="Copy link"
                onClick={handleCopyLink}
              />
            </div>

            {/* Comments */}
            {showComments && (
              <div className="mt-3 pt-3 animate-fade-in">
                <CommentSection
                  postId={post.id}
                  onCommentAdded={() => setCommentCount((prev) => prev + 1)}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {showReportModal && (
        <ReportModal
          targetType="post"
          targetId={post.id}
          onClose={() => setShowReportModal(false)}
        />
      )}
    </article>
  );
};
