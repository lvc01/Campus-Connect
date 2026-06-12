"use client";

import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/Avatar";
import { cn } from "@/lib/utils";
import { getRelativeTimeShort } from "@/lib/utils";
import type { PostAuthor } from "@/types/post";

interface CommentData {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  parent_id: string | null;
  like_count: number;
  created_at: string;
  author: PostAuthor;
  replies: CommentData[];
}

interface CommentSectionProps {
  postId: string;
  onCommentAdded: () => void;
}

export const CommentSection: React.FC<CommentSectionProps> = ({ postId, onCommentAdded }) => {
  const [comments, setComments] = useState<CommentData[]>([]);
  const [newCommentText, setNewCommentText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(true);

  const fetchComments = async () => {
    try {
      const response = await apiClient.get<CommentData[]>(`/posts/${postId}/comments`);
      window.setTimeout(() => setComments(response.data), 0);
    } catch (err) {
      console.error("Failed to load comments", err);
    } finally {
      window.setTimeout(() => setCommentsLoading(false), 0);
    }
  };

  useEffect(() => {
    fetchComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  const handleSubmitComment = async (e: React.FormEvent, parentId: string | null = null, replyText = "") => {
    e.preventDefault();
    const text = parentId ? replyText : newCommentText;
    if (!text.trim()) return;

    setIsLoading(true);

    try {
      await apiClient.post(`/posts/${postId}/comments`, {
        content: text.trim(),
        parent_id: parentId,
      });

      if (!parentId) {
        setNewCommentText("");
      }
      onCommentAdded();
      await fetchComments();
    } catch (err) {
      console.error("Failed to add comment", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={(e) => handleSubmitComment(e)} className="flex gap-2">
        <label htmlFor={`comment-input-${postId}`} className="visually-hidden">Write a comment</label>
        <input
          id={`comment-input-${postId}`}
          type="text"
          placeholder="Write a comment..."
          value={newCommentText}
          onChange={(e) => setNewCommentText(e.target.value)}
          className="flex-1 min-h-[38px] px-3 rounded-xl bg-bg-surface border border-border text-text-primary text-sm placeholder:text-text-tertiary transition-colors outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
        <Button type="submit" isLoading={isLoading} disabled={!newCommentText.trim()} className="shrink-0" size="xs">
          Reply
        </Button>
      </form>

      {commentsLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-4 w-4 text-accent animate-spin" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-center text-sm text-text-tertiary py-4">No comments yet. Be the first to share your thoughts.</p>
      ) : (
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              onSubmitReply={(e, replyText) => handleSubmitComment(e, comment.id, replyText)}
              isLoading={isLoading}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface CommentItemProps {
  comment: CommentData;
  onSubmitReply: (e: React.FormEvent, replyText: string) => Promise<void>;
  isLoading: boolean;
  depth?: number;
}

const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  onSubmitReply,
  isLoading,
  depth = 0,
}) => {
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyText] = useState("");

  const authorProfile = comment.author?.profile;
  const authorName = authorProfile?.display_name || "Student";
  const handle = comment.author?.email?.split("@")[0] || "user";
  const authorAvatar = authorProfile?.avatar_url;

  const handleReplySubmit = async (e: React.FormEvent) => {
    await onSubmitReply(e, replyText);
    setReplyText("");
    setShowReplyInput(false);
  };

  return (
    <div className={cn("space-y-2", depth > 0 && "ml-10 pl-4 border-l-2 border-border")}>
      <div className="flex gap-2.5 items-start">
        <Avatar
          user={{ name: authorName, profile: { avatar_url: authorAvatar } }}
          size={32}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold text-text-primary">
              {authorName}
            </span>
            <span className="text-xs text-text-secondary">
              @{handle}
            </span>
            <span className="text-xs text-text-tertiary">·</span>
            <span className="text-xs text-text-secondary">
              {getRelativeTimeShort(comment.created_at)}
            </span>
          </div>

          <p className="mt-1 text-sm text-text-primary leading-relaxed">
            {comment.content}
          </p>

          <div className="mt-1.5 flex gap-3">
            <button
              type="button"
              onClick={() => setShowReplyInput(!showReplyInput)}
              className="text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
            >
              Reply
            </button>
          </div>

          {showReplyInput && (
            <form onSubmit={handleReplySubmit} className="mt-2 flex gap-2 animate-fade-in">
              <label htmlFor={`reply-input-${comment.id}`} className="visually-hidden">Write a reply</label>
              <input
                id={`reply-input-${comment.id}`}
                type="text"
                placeholder={`Reply to ${authorName}...`}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="flex-1 min-h-[36px] px-3 rounded-xl bg-bg-surface border border-border text-text-primary text-sm placeholder:text-text-tertiary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                required
              />
              <Button type="submit" isLoading={isLoading} disabled={!replyText.trim()} className="shrink-0" size="xs">
                Reply
              </Button>
            </form>
          )}
        </div>
      </div>

      {comment.replies && comment.replies.length > 0 && depth < 3 && (
        <div className="space-y-3">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              onSubmitReply={onSubmitReply}
              isLoading={isLoading}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};
