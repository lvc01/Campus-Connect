"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, AtSign } from "lucide-react";
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

interface MentionUser {
  id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  email: string;
}

export const CommentSection: React.FC<CommentSectionProps> = ({ postId, onCommentAdded }) => {
  const [comments, setComments] = useState<CommentData[]>([]);
  const [newCommentText, setNewCommentText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(true);

  // Mention state
  const [, setMentionQuery] = useState("");
  const [mentionResults, setMentionResults] = useState<MentionUser[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionLoading, setMentionLoading] = useState(false);
  const [selectedMentions, setSelectedMentions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const mentionSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const searchMentions = useCallback(async (query: string) => {
    if (query.length < 1) {
      setMentionResults([]);
      setShowMentions(false);
      return;
    }
    setMentionLoading(true);
    try {
      const { data } = await apiClient.get("/search/users", {
        params: { q: query, limit: 5 },
      });
      const items = data.items || data;
      setMentionResults(items);
      setShowMentions(true);
    } catch {
      setMentionResults([]);
    } finally {
      setMentionLoading(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewCommentText(value);

    // Check for @ mention trigger
    const cursorPos = e.target.selectionStart || 0;
    const textBeforeCursor = value.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      const query = mentionMatch[1];
      setMentionQuery(query);
      if (mentionSearchTimeout.current) {
        clearTimeout(mentionSearchTimeout.current);
      }
      mentionSearchTimeout.current = setTimeout(() => {
        searchMentions(query);
      }, 300);
    } else {
      setShowMentions(false);
      setMentionQuery("");
    }
  };

  const handleMentionSelect = (user: MentionUser) => {
    const cursorPos = inputRef.current?.selectionStart || 0;
    const textBeforeCursor = newCommentText.slice(0, cursorPos);
    const textAfterCursor = newCommentText.slice(cursorPos);

    // Find the @ trigger position
    const atIndex = textBeforeCursor.lastIndexOf("@");
    if (atIndex === -1) return;

    const beforeAt = textBeforeCursor.slice(0, atIndex);
    const displayName = user.username || user.display_name;
    const newText = `${beforeAt}@${displayName} ${textAfterCursor}`;

    setNewCommentText(newText);
    setSelectedMentions((prev) => [...prev, user.id]);
    setShowMentions(false);
    setMentionQuery("");

    // Refocus input
    setTimeout(() => {
      if (inputRef.current) {
        const newPos = atIndex + displayName.length + 2;
        inputRef.current.focus();
        inputRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  const insertAtMention = () => {
    const cursorPos = inputRef.current?.selectionStart || 0;
    const textBefore = newCommentText.slice(0, cursorPos);
    const textAfter = newCommentText.slice(cursorPos);

    // Add @ at cursor position
    const newText = `${textBefore}@${textAfter}`;
    setNewCommentText(newText);

    // Focus and position cursor after @
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newPos = cursorPos + 1;
        inputRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  const handleSubmitComment = async (e: React.FormEvent, parentId: string | null = null, replyText = "", replyMentions: string[] = []) => {
    e.preventDefault();
    const text = parentId ? replyText : newCommentText;
    const mentions = parentId ? replyMentions : selectedMentions;
    if (!text.trim()) return;

    setIsLoading(true);

    try {
      await apiClient.post(`/posts/${postId}/comments`, {
        content: text.trim(),
        parent_id: parentId,
        mentioned_users: mentions.length > 0 ? mentions : undefined,
      });

      if (!parentId) {
        setNewCommentText("");
        setSelectedMentions([]);
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
      {/* Comment input with @ button */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <label htmlFor={`comment-input-${postId}`} className="visually-hidden">Write a comment</label>
          <input
            id={`comment-input-${postId}`}
            ref={inputRef}
            type="text"
            placeholder="Write a comment..."
            value={newCommentText}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !showMentions) {
                handleSubmitComment(e);
              }
              if (e.key === "Escape") {
                setShowMentions(false);
              }
            }}
            className="w-full min-h-[38px] px-3 pr-10 rounded-xl bg-surface border border-border-strong text-text-primary text-sm placeholder:text-text-tertiary transition-colors outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          <button
            type="button"
            onClick={insertAtMention}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-surface text-text-tertiary hover:text-text-primary transition-colors"
            title="Mention someone"
          >
            <AtSign className="h-4 w-4" />
          </button>

          {/* Mention dropdown */}
          {showMentions && (
            <div className="absolute bottom-full left-0 right-0 mb-1 bg-surface border border-border-strong rounded-xl shadow-lg overflow-hidden z-50">
              {mentionLoading ? (
                <div className="flex items-center justify-center py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-text-tertiary" />
                </div>
              ) : mentionResults.length === 0 ? (
                <div className="px-3 py-2 text-xs text-text-tertiary">No users found</div>
              ) : (
                <ul className="max-h-48 overflow-y-auto">
                  {mentionResults.map((user) => (
                    <li key={user.id}>
                      <button
                        type="button"
                        onClick={() => handleMentionSelect(user)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-surface transition-colors text-left"
                      >
                        <Avatar
                          user={{ name: user.display_name, profile: { avatar_url: user.avatar_url } }}
                          size={28}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-text-primary truncate">
                            {user.display_name}
                          </p>
                          <p className="text-xs text-text-secondary truncate">
                            @{user.username || user.email.split("@")[0]}
                          </p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        <Button
          type="button"
          onClick={(e) => handleSubmitComment(e)}
          isLoading={isLoading}
          disabled={!newCommentText.trim()}
          className="shrink-0"
          size="xs"
        >
          Reply
        </Button>
      </div>

      {commentsLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-4 w-4 text-accent animate-spin" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-center text-sm text-text-tertiary py-4">
          No comments yet. Be the first to share your thoughts.
        </p>
      ) : (
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              onSubmitReply={(e, replyText, replyMentions) =>
                handleSubmitComment(e, comment.id, replyText, replyMentions)
              }
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
  onSubmitReply: (e: React.FormEvent, replyText: string, replyMentions: string[]) => Promise<void>;
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
  const [replyMentions, setReplyMentions] = useState<string[]>([]);
  const [, setMentionQuery] = useState("");
  const [mentionResults, setMentionResults] = useState<MentionUser[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionLoading, setMentionLoading] = useState(false);
  const replyInputRef = useRef<HTMLInputElement>(null);
  const mentionSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const authorProfile = comment.author?.profile;
  const authorName = authorProfile?.display_name || "Student";
  const authorUsername = comment.author?.username || comment.author?.email?.split("@")[0] || "user";
  const authorAvatar = authorProfile?.avatar_url;

  const handleReplySubmit = async (e: React.FormEvent) => {
    await onSubmitReply(e, replyText, replyMentions);
    setReplyText("");
    setReplyMentions([]);
    setShowReplyInput(false);
  };

  const startReply = () => {
    setShowReplyInput(true);
    // Pre-fill with @username
    const username = comment.author?.username || comment.author?.email?.split("@")[0];
    if (username) {
      setReplyText(`@${username} `);
      setReplyMentions([comment.author_id]);
    }
  };

  const handleReplyInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setReplyText(value);

    const cursorPos = e.target.selectionStart || 0;
    const textBeforeCursor = value.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      const query = mentionMatch[1];
      setMentionQuery(query);
      if (mentionSearchTimeout.current) {
        clearTimeout(mentionSearchTimeout.current);
      }
      mentionSearchTimeout.current = setTimeout(async () => {
        if (query.length < 1) {
          setMentionResults([]);
          setShowMentions(false);
          return;
        }
        setMentionLoading(true);
        try {
          const { data } = await apiClient.get("/search/users", {
            params: { q: query, limit: 5 },
          });
          setMentionResults(data.items || data);
          setShowMentions(true);
        } catch {
          setMentionResults([]);
        } finally {
          setMentionLoading(false);
        }
      }, 300);
    } else {
      setShowMentions(false);
    }
  };

  const handleMentionSelect = (user: MentionUser) => {
    const cursorPos = replyInputRef.current?.selectionStart || 0;
    const textBeforeCursor = replyText.slice(0, cursorPos);
    const textAfterCursor = replyText.slice(cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf("@");
    if (atIndex === -1) return;

    const beforeAt = textBeforeCursor.slice(0, atIndex);
    const displayName = user.username || user.display_name;
    const newText = `${beforeAt}@${displayName} ${textAfterCursor}`;

    setReplyText(newText);
    setReplyMentions((prev) => [...prev, user.id]);
    setShowMentions(false);

    setTimeout(() => {
      if (replyInputRef.current) {
        const newPos = atIndex + displayName.length + 2;
        replyInputRef.current.focus();
        replyInputRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  // Highlight @mentions in comment content
  const renderContent = (text: string) => {
    const parts = text.split(/(?<!@)@[\w.]+/g);
    const matches = text.match(/(?<!@)@[\w.]+/g);
    if (!matches) return text;

    return parts.reduce<React.ReactNode[]>((acc, part, i) => {
      acc.push(part);
      if (i < matches.length) {
        acc.push(
          <span key={i} className="text-accent font-semibold">
            {matches[i]}
          </span>
        );
      }
      return acc;
    }, []);
  };

  return (
    <div className={cn("space-y-2", depth > 0 && "ml-10 pl-4 border-l-2 border-border-quiet")}>
      <div className="flex gap-2.5 items-start">
        <Avatar
          user={{ name: authorName, profile: { avatar_url: authorAvatar } }}
          size={32}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-display text-body-sm font-medium text-text-primary">
              {authorName}
            </span>
            <span className="text-xs text-accent font-medium">
              @{authorUsername}
            </span>
            <span className="text-xs text-text-tertiary">·</span>
            <span className="text-xs text-text-secondary">
              {getRelativeTimeShort(comment.created_at)}
            </span>
          </div>

          <p className="mt-1 text-sm text-text-primary leading-relaxed">
            {renderContent(comment.content)}
          </p>

          <div className="mt-1.5 flex gap-3">
            <button
              type="button"
              onClick={startReply}
              className="text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
            >
              Reply
            </button>
          </div>

          {showReplyInput && (
            <div className="mt-2 space-y-1 animate-fade-in">
              <div className="relative">
                <label htmlFor={`reply-input-${comment.id}`} className="visually-hidden">Write a reply</label>
                <input
                  id={`reply-input-${comment.id}`}
                  ref={replyInputRef}
                  type="text"
                  placeholder={`Reply to ${authorName}...`}
                  value={replyText}
                  onChange={handleReplyInputChange}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !showMentions) {
                      handleReplySubmit(e);
                    }
                    if (e.key === "Escape") {
                      setShowMentions(false);
                    }
                  }}
                  className="w-full min-h-[36px] px-3 rounded-xl bg-surface border border-border-strong text-text-primary text-sm placeholder:text-text-tertiary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                  required
                />

                {/* Reply mention dropdown */}
                {showMentions && (
                  <div className="absolute bottom-full left-0 right-0 mb-1 bg-surface border border-border-strong rounded-xl shadow-lg overflow-hidden z-50">
                    {mentionLoading ? (
                      <div className="flex items-center justify-center py-3">
                        <Loader2 className="h-4 w-4 animate-spin text-text-tertiary" />
                      </div>
                    ) : mentionResults.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-text-tertiary">No users found</div>
                    ) : (
                      <ul className="max-h-48 overflow-y-auto">
                        {mentionResults.map((user) => (
                          <li key={user.id}>
                            <button
                              type="button"
                              onClick={() => handleMentionSelect(user)}
                              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-surface transition-colors text-left"
                            >
                              <Avatar
                                user={{ name: user.display_name, profile: { avatar_url: user.avatar_url } }}
                                size={28}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-text-primary truncate">
                                  {user.display_name}
                                </p>
                                <p className="text-xs text-text-secondary truncate">
                                  @{user.username || user.email.split("@")[0]}
                                </p>
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={handleReplySubmit}
                  isLoading={isLoading}
                  disabled={!replyText.trim()}
                  className="shrink-0"
                  size="xs"
                >
                  Reply
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setShowReplyInput(false);
                    setReplyText("");
                    setReplyMentions([]);
                  }}
                  variant="secondary"
                  className="shrink-0"
                  size="xs"
                >
                  Cancel
                </Button>
              </div>
            </div>
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
