"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Flag } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { Avatar } from "@/components/Avatar";
import { RoleBadge } from "@/components/RoleBadge";
import { apiClient } from "@/lib/api-client";
import { ReportModal } from "@/components/report-modal";

interface CommentAuthor {
  id: string;
  email: string;
  role?: string;
  profile?: {
    display_name?: string | null;
    avatar_url?: string | null;
  } | null;
}

interface CommentData {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  parent_id: string | null;
  author: CommentAuthor;
  like_count: number;
  created_at: string;
  replies: CommentData[];
}

interface CommentThreadProps {
  comments: CommentData[];
  postId: string;
  depth?: number;
  maxDepth?: number;
  onCommentAdded?: () => void;
}

export function CommentThread({ comments, postId, depth = 0, onCommentAdded }: CommentThreadProps) {
  const maxDepth = 3;

  return (
    <div className={depth > 0 ? "ml-4 border-l border-border pl-3" : ""}>
      {comments.map((comment, i) => (
        <div
          key={comment.id}
          className="animate-fade-in"
          style={{ animationDelay: `${Math.min(i * 30, 200)}ms` }}
        >
          <CommentItem
            comment={comment}
            postId={postId}
            depth={depth}
            maxDepth={maxDepth}
            onCommentAdded={onCommentAdded}
          />
        </div>
      ))}
    </div>
  );
}

function CommentItem({
  comment,
  postId,
  depth,
  maxDepth,
  onCommentAdded,
}: {
  comment: CommentData;
  postId: string;
  depth: number;
  maxDepth: number;
  onCommentAdded?: () => void;
}) {
  const { user } = useAuth();
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [posting, setPosting] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const authorName = comment.author.profile?.display_name || comment.author.email;
  const isOwner = user?.id === comment.author_id;

  const handleReply = async () => {
    if (!replyText.trim() || posting) return;
    setPosting(true);
    try {
      await apiClient.post(`/posts/${postId}/comments`, {
        content: replyText.trim(),
        parent_id: comment.id,
      });
      setReplyText("");
      setShowReply(false);
      toast.success("Reply posted");
      onCommentAdded?.();
    } catch {
      toast.error("Failed to post reply");
    } finally {
      setPosting(false);
    }
  };

  return (
    <>
      <div className="py-2">
        <div className="flex gap-2">
          <Link href={`/profile/${comment.author_id}`}>
            <Avatar user={comment.author} size={28} />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Link href={`/profile/${comment.author_id}`} className="flex items-center gap-1.5 text-xs font-semibold text-text-primary hover:underline">
                {authorName}
                {comment.author.role && <RoleBadge role={comment.author.role} hideStudent size={11} />}
              </Link>
              <span className="text-[11px] text-text-secondary">
                {new Date(comment.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-text-primary">{comment.content}</p>
            <div className="mt-1 flex items-center gap-3">
              {user && depth < maxDepth && (
                <button
                  onClick={() => setShowReply(!showReply)}
                  className="text-[12px] text-text-secondary hover:text-accent transition-all active:scale-95 rounded px-1.5 py-0.5 hover:bg-accent/10"
                >
                  Reply
                </button>
              )}
              {user && !isOwner && (
                <button
                  onClick={() => setShowReport(true)}
                  className="text-[12px] text-text-secondary hover:text-like transition-all active:scale-95 rounded px-1.5 py-0.5 hover:bg-like/10"
                >
                  <Flag className="h-3 w-3 inline mr-0.5" />
                  Report
                </button>
              )}
            </div>

            {showReply && (
              <div className="mt-2 flex gap-2 animate-fade-in">
                <Avatar user={user!} size={24} />
                <div className="flex-1 flex gap-2">
                  <input
                    autoFocus
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleReply()}
                    placeholder="Write a reply..."
                    className="flex-1 rounded-full border border-border bg-surface px-3 py-1 text-xs text-text-primary outline-none focus:border-accent transition-colors"
                  />
                  <button
                    onClick={handleReply}
                    disabled={!replyText.trim() || posting}
                    className="text-xs font-semibold text-accent hover:opacity-80 active:scale-95 transition-all disabled:opacity-40"
                  >
                    {posting ? "..." : "Post"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {comment.replies.length > 0 && depth < maxDepth && (
          <CommentThread
            comments={comment.replies}
            postId={postId}
            depth={depth + 1}
            maxDepth={maxDepth}
            onCommentAdded={onCommentAdded}
          />
        )}
      </div>

      {showReport && (
        <ReportModal
          targetType="comment"
          targetId={comment.id}
          onClose={() => setShowReport(false)}
        />
      )}
    </>
  );
}
