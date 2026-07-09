"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Heart, MessageCircle, Bookmark, Share2, Lock } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { BackLink } from "@/components/layout/BackLink";
import { DetailSkeleton } from "@/components/ui/detail-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { RoleBadge } from "@/components/RoleBadge";
import { MentionHighlight } from "@/components/MentionHighlight";
import { MediaGallery } from "@/components/MediaGallery";
import { PollView } from "@/components/PollView";
import { PostMenu } from "@/components/feed/PostMenu";
import { CommentSection } from "@/components/comment-section";
import { apiClient } from "@/lib/api-client";
import { cn, formatCount, getRelativeTime } from "@/lib/utils";
import type { PostData } from "@/types/post";

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const postId = params.id as string;

  const [post, setPost] = useState<PostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPost = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await apiClient.get(`/posts/${postId}`);
      setPost(data);
    } catch {
      setError("Post not found");
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPost();
  }, [fetchPost]);

  async function handleLike() {
    if (!post) return;
    try {
      if (post.is_liked) {
        await apiClient.delete(`/posts/${postId}/like`);
        setPost({ ...post, is_liked: false, like_count: post.like_count - 1 });
      } else {
        await apiClient.post(`/posts/${postId}/like`);
        setPost({ ...post, is_liked: true, like_count: post.like_count + 1 });
      }
    } catch {}
  }

  async function handleSave() {
    if (!post) return;
    try {
      if (post.is_saved) {
        await apiClient.delete(`/posts/${postId}/save`);
        setPost({ ...post, is_saved: false });
      } else {
        await apiClient.post(`/posts/${postId}/save`);
        setPost({ ...post, is_saved: true });
      }
    } catch {}
  }

  async function handleShare() {
    if (!post) return;
    try {
      if (post.is_shared) {
        await apiClient.delete(`/posts/${postId}/share`);
        setPost({ ...post, is_shared: false, share_count: post.share_count - 1 });
      } else {
        await apiClient.post(`/posts/${postId}/share`);
        setPost({ ...post, is_shared: true, share_count: post.share_count + 1 });
      }
    } catch {}
  }

  if (loading) {
    return (
      <div className="min-h-screen flex-1 bg-background">
        <DetailSkeleton />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="flex min-h-screen flex-1 flex-col items-center justify-center bg-background">
        <ErrorState
          title={error || "Post not found"}
          message="This post may have been deleted or is unavailable."
          onRetry={fetchPost}
        />
        <Link href="/" className="mt-2 text-sm text-accent hover:underline">Go home</Link>
      </div>
    );
  }

  const author = post.author;
  const authorName = author.profile?.display_name || author.email.split("@")[0];
  const authorHandle = author.username || author.email.split("@")[0];

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-background text-text-primary">
      <div className="relative z-10 mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        <BackLink href="/" />

        <article className="overflow-hidden rounded-2xl border border-border bg-surface">
          {/* Author header */}
          <div className="flex items-start gap-3 p-4">
            <Link href={`/profile/${author.id}`}>
              <Avatar user={author} size={44} />
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Link href={`/profile/${author.id}`} className="truncate font-semibold text-text-primary hover:underline">
                  {authorName}
                </Link>
                <RoleBadge role={author.role} hideStudent />
              </div>
              <div className="flex items-center gap-1.5 text-caption text-text-secondary">
                <span className="truncate">@{authorHandle}</span>
                <span>·</span>
                <span className="shrink-0">{getRelativeTime(post.created_at)}</span>
                {post.visibility === "faculty_only" && <Lock className="h-3 w-3 text-accent" />}
              </div>
            </div>
            <PostMenu
              postId={post.id}
              authorId={post.author_id}
              content={post.content}
              onDeleted={() => router.push("/")}
              onEdited={(newContent) => setPost({ ...post, content: newContent })}
            />
          </div>

          {/* Content */}
          {post.content && (
            <div className="px-4 pb-1">
              <p className="whitespace-pre-wrap break-words leading-relaxed text-text-primary">
                <MentionHighlight text={post.content} />
              </p>
            </div>
          )}

          {/* Media */}
          {post.media && post.media.length > 0 && (
            <div className="px-4">
              <MediaGallery media={post.media} />
            </div>
          )}

          {/* Poll */}
          {post.poll && (
            <div className="px-4">
              <PollView postId={post.id} poll={post.poll} />
            </div>
          )}

          {/* Interaction bar */}
          <div className="mt-3 flex items-center gap-1 border-t border-border px-4 py-3">
            <button
              onClick={handleLike}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors",
                post.is_liked ? "text-like" : "text-text-secondary hover:text-like hover:bg-like/10",
              )}
            >
              <Heart className={cn("h-5 w-5", post.is_liked && "fill-current")} />
              <span>{formatCount(post.like_count)}</span>
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-text-secondary">
              <MessageCircle className="h-5 w-5" />
              <span>{formatCount(post.comment_count)}</span>
            </button>
            <button
              onClick={handleShare}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors",
                post.is_shared ? "text-repost" : "text-text-secondary hover:text-repost hover:bg-repost/10",
              )}
            >
              <Share2 className={cn("h-5 w-5", post.is_shared && "fill-current")} />
              <span>{formatCount(post.share_count)}</span>
            </button>
            <div className="flex-1" />
            <button
              onClick={handleSave}
              className={cn(
                "inline-flex items-center rounded-full px-2 py-1.5 transition-colors",
                post.is_saved ? "text-accent" : "text-text-secondary hover:text-accent hover:bg-accent/10",
              )}
            >
              <Bookmark className={cn("h-5 w-5", post.is_saved && "fill-current")} />
            </button>
          </div>

          {/* Comments */}
          <div className="border-t border-border">
            <CommentSection
              postId={post.id}
              onCommentAdded={() => setPost((prev) => (prev ? { ...prev, comment_count: prev.comment_count + 1 } : prev))}
            />
          </div>
        </article>
      </div>
    </div>
  );
}
