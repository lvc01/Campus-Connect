"use client";

import { useState } from "react";
import { Heart, MessageCircle, Bookmark, Repeat2, Link as LinkIcon, Lock, Check } from "lucide-react";
import NextLink from "next/link";
import { toast } from "sonner";
import { useAuth } from "@/context/auth-context";
import { Avatar } from "@/components/Avatar";
import { HashtagText } from "@/components/HashtagText";
import { CommentThread } from "./Comment";
import { PostMenu } from "./PostMenu";
import { apiClient } from "@/lib/api-client";
import { cn, formatCount } from "@/lib/utils";
import type { PostData, PostAuthor, PollData } from "@/types/post";

interface PostComment {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  parent_id: string | null;
  author: PostAuthor;
  like_count: number;
  created_at: string;
  replies: PostComment[];
}

function getRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function PostCard({ post, onPostDeleted }: { post: PostData; onPostDeleted?: () => void }) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(post.is_liked);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [likeLoading, setLikeLoading] = useState(false);
  const [saved, setSaved] = useState(post.is_saved);
  const [saveLoading, setSaveLoading] = useState(false);
  const [reposted, setReposted] = useState(post.is_shared);
  const [repostCount, setRepostCount] = useState(post.share_count);
  const [repostLoading, setRepostLoading] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [likeAnimating, setLikeAnimating] = useState(false);
  const [commentCount, setCommentCount] = useState(post.comment_count);
  const [commentText, setCommentText] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [editedContent, setEditedContent] = useState<string | null>(null);
  const [pollData, setPollData] = useState<PollData | null>(post.poll ?? null);
  const [votingOptionId, setVotingOptionId] = useState<string | null>(null);

  const authorName = post.author.profile?.display_name || post.author.email;
  const authorHandle = post.author.email.split("@")[0];

  const handleLike = async () => {
    if (!user || likeLoading) return;
    setLikeAnimating(true);
    setTimeout(() => setLikeAnimating(false), 350);
    setLikeLoading(true);
    try {
      if (liked) {
        await apiClient.delete(`/posts/${post.id}/like`);
        setLiked(false);
        setLikeCount((c) => c - 1);
      } else {
        await apiClient.post(`/posts/${post.id}/like`);
        setLiked(true);
        setLikeCount((c) => c + 1);
      }
    } catch {
      toast.error("Failed to update like");
    } finally {
      setLikeLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user || saveLoading) return;
    setSaveLoading(true);
    try {
      if (saved) {
        await apiClient.delete(`/posts/${post.id}/save`);
        setSaved(false);
      } else {
        await apiClient.post(`/posts/${post.id}/save`);
        setSaved(true);
      }
    } catch {
      toast.error("Failed to update bookmark");
    } finally {
      setSaveLoading(false);
    }
  };

  const handleRepost = async () => {
    if (!user || repostLoading) return;
    setRepostLoading(true);
    try {
      if (reposted) {
        await apiClient.delete(`/posts/${post.id}/share`);
        setReposted(false);
        setRepostCount((c) => c - 1);
        toast.success("Repost removed");
      } else {
        await apiClient.post(`/posts/${post.id}/share`);
        setReposted(true);
        setRepostCount((c) => c + 1);
        toast.success("Reposted to your feed!");
      }
    } catch {
      toast.error("Failed to update share");
    } finally {
      setRepostLoading(false);
    }
  };

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/#${post.id}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Fallback for non-HTTPS / clipboard API blocked
      const textarea = document.createElement("textarea");
      textarea.value = url;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    toast.success("Link copied!");
  };

  const handleVote = async (optionId: string) => {
    if (!user || votingOptionId) return;
    const previousVote = pollData?.user_vote_option_id ?? null;
    const isSameVote = previousVote === optionId;
    setVotingOptionId(optionId);
    try {
      await apiClient.post(`/posts/${post.id}/poll/vote`, { option_id: optionId });
      // Update local poll data optimistically
      if (pollData && !isSameVote) {
        const newOptions = pollData.options.map((opt) => {
          if (opt.id === optionId) {
            return { ...opt, vote_count: opt.vote_count + 1 };
          }
          if (opt.id === previousVote) {
            return { ...opt, vote_count: Math.max(0, opt.vote_count - 1) };
          }
          return opt;
        });
        setPollData({
          options: newOptions,
          total_votes: previousVote ? pollData.total_votes : pollData.total_votes + 1,
          user_vote_option_id: optionId,
        });
      } else if (pollData && isSameVote) {
        // Unvoting: remove vote
        const newOptions = pollData.options.map((opt) =>
          opt.id === optionId ? { ...opt, vote_count: Math.max(0, opt.vote_count - 1) } : opt
        );
        setPollData({
          options: newOptions,
          total_votes: Math.max(0, pollData.total_votes - 1),
          user_vote_option_id: null,
        });
      }
    } catch {
      toast.error("Failed to vote");
    } finally {
      setVotingOptionId(null);
    }
  };

  const toggleComments = async () => {
    if (showComments) {
      setShowComments(false);
      return;
    }
    setShowComments(true);
    if (comments.length === 0) {
      setLoadingComments(true);
      try {
        const res = await apiClient.get(`/posts/${post.id}/comments`);
        setComments(res.data);
      } catch {
        toast.error("Failed to load comments");
      } finally {
        setLoadingComments(false);
      }
    }
  };

  const handleCommentAdded = async () => {
    setCommentCount((c) => c + 1);
    try {
      const res = await apiClient.get(`/posts/${post.id}/comments`);
      setComments(res.data);
    } catch {
      // ignore
    }
  };

  const handlePostComment = async () => {
    if (!commentText.trim() || postingComment) return;
    setPostingComment(true);
    try {
      await apiClient.post(`/posts/${post.id}/comments`, {
        content: commentText.trim(),
      });
      setCommentText("");
      setCommentCount((c) => c + 1);
      toast.success("Comment posted");
      const res = await apiClient.get(`/posts/${post.id}/comments`);
      setComments(res.data);
    } catch {
      toast.error("Failed to post comment");
    } finally {
      setPostingComment(false);
    }
  };

  return (
    <article className="border-b border-border px-6 py-4">
      <div className="flex gap-3">
        <NextLink href={`/profile/${post.author_id}`}>
          <Avatar user={post.author} size={40} />
        </NextLink>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <NextLink href={`/profile/${post.author_id}`} className="text-body-sm font-semibold text-text-primary hover:underline">
              {authorName}
            </NextLink>
            <span className="text-caption text-text-secondary">@{authorHandle}</span>
            <span className="text-caption text-text-secondary">·</span>
            <span className="text-caption text-text-secondary">{getRelativeTime(post.created_at)}</span>
            {editedContent !== null && (
              <span className="text-caption text-text-secondary italic">· Edited</span>
            )}
            {post.visibility === "faculty_only" && (
              <Lock className="h-3 w-3 text-accent" />
            )}
            <div className="ml-auto">
              <PostMenu
                postId={post.id}
                authorId={post.author_id}
                content={editedContent ?? post.content}
                onDeleted={() => {
                  // Remove this post from the DOM by setting content to null
                  // The parent Feed component should handle removal
                  onPostDeleted?.();
                }}
                onEdited={(newContent) => {
                  // Update local content display
                  setEditedContent(newContent);
                }}
              />
            </div>
          </div>

          {(editedContent ?? post.content) && (
            <p className="mt-1 text-body text-text-primary whitespace-pre-wrap">
              <HashtagText text={editedContent ?? post.content ?? ""} />
            </p>
          )}

          {post.media.length > 0 && (
            <div className="mt-3 overflow-hidden rounded-lg">
              {post.media.map((m) => (
                <div key={m.id}>
                  {m.media_type === "image" ? (
                    <img src={m.url} alt="" className="w-full object-cover" loading="lazy" />
                  ) : (
                    <video src={m.url} className="w-full" controls />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Poll display */}
          {pollData && (
            <div className="mt-3 space-y-1.5">
              {pollData.options.map((opt) => {
                const pct = pollData.total_votes > 0 ? Math.round((opt.vote_count / pollData.total_votes) * 100) : 0;
                const isSelected = pollData.user_vote_option_id === opt.id;
                const hasVoted = pollData.user_vote_option_id !== null;
                return (
                  <button
                    key={opt.id}
                    onClick={() => handleVote(opt.id)}
                    disabled={votingOptionId !== null}
                    className={cn(
                      "w-full rounded-xl border px-3.5 py-2.5 text-left text-sm font-medium transition-all duration-200 relative overflow-hidden",
                      hasVoted
                        ? isSelected
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-border bg-surface text-text-secondary"
                        : "border-border bg-surface hover:border-accent/50 hover:bg-accent/5 text-text-primary",
                      votingOptionId !== null && "opacity-60 cursor-not-allowed",
                    )}
                  >
                    {/* Background fill bar */}
                    {hasVoted && (
                      <div
                        className={cn(
                          "absolute inset-y-0 left-0 transition-all duration-500 ease-out",
                          isSelected ? "bg-accent/15" : "bg-border/50"
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    )}
                    <span className="relative flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        {isSelected && <Check size={14} className="text-accent shrink-0" />}
                        {opt.text}
                      </span>
                      {hasVoted && (
                        <span className={cn("text-xs tabular-nums", isSelected ? "text-accent font-semibold" : "text-text-secondary")}>
                          {pct}%
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
              <p className="text-[11px] text-text-secondary pt-0.5">
                {pollData.total_votes} {pollData.total_votes === 1 ? "vote" : "votes"}
              </p>
            </div>
          )}

          <div className="mt-3 flex items-center gap-6 text-text-secondary">
            <button
              onClick={toggleComments}
              className={cn(
                "flex items-center gap-1.5 text-body-sm rounded-full px-3 py-1.5 transition-all active:scale-95",
                showComments ? "text-accent bg-accent/10" : "hover:text-accent hover:bg-accent/10",
              )}
            >
              <MessageCircle className="h-[18px] w-[18px]" />
              <span className="text-[13px]">{formatCount(commentCount)}</span>
            </button>

            <button
              onClick={handleRepost}
              disabled={repostLoading}
              className={cn(
                "flex items-center gap-1.5 text-body-sm rounded-full px-3 py-1.5 transition-all active:scale-95",
                reposted
                  ? "text-repost bg-repost/10"
                  : "hover:text-repost hover:bg-repost/10",
                repostLoading && "opacity-60 cursor-not-allowed",
              )}
            >
              <Repeat2 className={cn("h-[18px] w-[18px]", reposted && "fill-current")} />
              <span className="text-[13px]">{formatCount(repostCount)}</span>
            </button>

            <button
              onClick={handleLike}
              disabled={likeLoading}
              className={cn(
                "flex items-center gap-1.5 text-body-sm rounded-full px-3 py-1.5 transition-all active:scale-95",
                liked ? "text-like bg-like/10" : "hover:text-like hover:bg-like/10",
                likeLoading && "opacity-60",
              )}
            >
              <Heart className={cn("h-[18px] w-[18px]", liked && "fill-current", likeAnimating && "like-pop")} />
              <span className="text-[13px]">{formatCount(likeCount)}</span>
            </button>

            <button
              onClick={handleSave}
              disabled={saveLoading}
              className={cn(
                "flex items text-body-sm rounded-full px-3 py-1.5 transition-all active:scale-95",
                saved ? "text-accent bg-accent/10" : "hover:text-accent hover:bg-accent/10",
                saveLoading && "opacity-60",
              )}
            >
              <Bookmark className={cn("h-[18px] w-[18px]", saved && "fill-current")} />
            </button>

            <button
              onClick={handleCopyLink}
              className="flex items text-body-sm rounded-full px-3 py-1.5 transition-all hover:text-accent hover:bg-accent/10 active:scale-95"
            >
              <LinkIcon className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
      </div>

      {showComments && (
        <div className="mt-3 ml-[52px] animate-fade-in">
          {user && (
            <div className="flex gap-2 mb-3">
              <Avatar user={user} size={28} />
              <div className="flex-1 flex gap-2">
                <input
                  autoFocus
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handlePostComment()}
                  placeholder="Write a comment..."
                  className="flex-1 rounded-full border border-border bg-surface px-3 py-1.5 text-caption text-text-primary outline-none focus:border-accent transition-colors"
                />
                <button
                  onClick={handlePostComment}
                  disabled={!commentText.trim() || postingComment}
                  className="text-caption font-semibold text-accent hover:opacity-80 active:scale-95 transition-all disabled:opacity-40"
                >
                  {postingComment ? "..." : "Post"}
                </button>
              </div>
            </div>
          )}
          {loadingComments ? (
            <div className="py-3 text-caption text-text-secondary">Loading comments...</div>
          ) : (
            <CommentThread
              comments={comments}
              postId={post.id}
              onCommentAdded={handleCommentAdded}
            />
          )}
        </div>
      )}
    </article>
  );
}
