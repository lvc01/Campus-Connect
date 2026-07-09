"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { MessageSquare, Heart, Loader2, MessageCircle, Repeat2 } from "lucide-react";
import { PostCard } from "@/components/feed/PostCard";
import { useFetchFeed } from "@/components/feed/hooks/use-fetch-feed";
import { apiClient } from "@/lib/api-client";
import { getRelativeTimeShort } from "@/lib/utils";
import { FeedErrorState } from "@/components/feed/feed-error-state";
import { FeedSkeletonList } from "@/components/feed/feed-skeleton-list";
import { EmptyState } from "@/components/ui/empty-state";
import { ProfileTabs, type ProfileTab } from "./profile-tabs";
import type { PostData } from "@/types/post";

interface CommentData {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  parent_id: string | null;
  like_count: number;
  created_at: string;
  author: {
    id: string;
    email: string;
    profile: {
      display_name: string;
      avatar_url: string | null;
    } | null;
  };
  post?: PostData | null;
}

export interface ProfilePostsListProps {
  userId: string;
}

export const ProfilePostsList: React.FC<ProfilePostsListProps> = ({ userId }) => {
  const [tab, setTab] = useState<ProfileTab>("posts");

  const postsFeed = useFetchFeed({ authorId: userId, enableRefreshEvent: false });

  const [comments, setComments] = useState<CommentData[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [commentsCursor, setCommentsCursor] = useState<string | null>(null);
  const [hasMoreComments, setHasMoreComments] = useState(false);

  const fetchComments = useCallback(async (cursor: string | null, append: boolean) => {
    setCommentsLoading(true);
    setCommentsError(null);
    try {
      const res = await apiClient.get(`/users/${userId}/replies`, {
        params: { cursor, limit: 20 },
      });
      const data = res.data as { items: CommentData[]; next_cursor: string | null; has_more: boolean };
      setComments((prev) => (append ? [...prev, ...data.items] : data.items));
      setCommentsCursor(data.next_cursor);
      setHasMoreComments(data.has_more);
    } catch {
      setCommentsError("Couldn't load replies. Try again.");
    } finally {
      setCommentsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (tab === "replies") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void fetchComments(null, false);
    }
  }, [tab, fetchComments]);

  const handleTabChange = (next: ProfileTab) => {
    setTab(next);
  };

  if (tab === "posts") {
    return (
      <>
        <ProfileTabs active={tab} onChange={handleTabChange} />
        {postsFeed.error ? (
          <FeedErrorState message={postsFeed.error} onRetry={() => void postsFeed.refresh()} />
        ) : postsFeed.isLoading ? (
          <FeedSkeletonList count={3} />
        ) : postsFeed.posts.length === 0 ? (
          <EmptyState
            icon={<MessageCircle className="h-6 w-6" />}
            title="No posts yet"
            description="This user hasn't posted anything yet."
          />
        ) : (
          <div className="divide-y divide-border-strong">
            {postsFeed.posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onPostDeleted={() => postsFeed.remove(post.id)}
              />
            ))}
            {/* eslint-disable react-hooks/refs */}
            <div ref={postsFeed.loaderRef} className="flex justify-center py-6">
              {(postsFeed.isMoreLoading || (postsFeed.hasMore && !postsFeed.isMoreLoading)) && (
                <Loader2 className="h-6 w-6 animate-spin text-accent" />
              )}
            </div>
            {/* eslint-enable react-hooks/refs */}
          </div>
        )}
      </>
    );
  }

  if (tab === "replies") {
    return (
      <>
        <ProfileTabs active={tab} onChange={handleTabChange} />
        {commentsError ? (
          <FeedErrorState message={commentsError} onRetry={() => void fetchComments(null, false)} />
        ) : commentsLoading && comments.length === 0 ? (
          <FeedSkeletonList count={3} />
        ) : comments.length === 0 ? (
          <EmptyState
            icon={<MessageCircle className="h-6 w-6" />}
            title="No replies yet"
            description="This user hasn't replied to any posts yet."
          />
        ) : (
          <div className="divide-y divide-border-strong">
            {comments.map((comment) => (
              <CommentCard key={comment.id} comment={comment} />
            ))}
            {hasMoreComments && (
              <div className="flex justify-center py-6">
                <button
                  onClick={() => void fetchComments(commentsCursor, true)}
                  disabled={commentsLoading}
                  className="font-sans text-body-sm text-text-tertiary hover:text-text-secondary transition-colors disabled:opacity-50"
                >
                  {commentsLoading ? "Loading..." : "Load more replies"}
                </button>
              </div>
            )}
          </div>
        )}
      </>
    );
  }

  if (tab === "media") {
    return <MediaTab userId={userId} />;
  }

  if (tab === "reposts") {
    return <RepostsTab userId={userId} />;
  }

  if (tab === "likes") {
    return <LikesTab userId={userId} />;
  }

  return null;
};

const CommentCard: React.FC<{ comment: CommentData }> = ({ comment }) => {
  const authorName = comment.author?.profile?.display_name || "Student";
  const handle = comment.author?.email?.split("@")[0] || "user";

  return (
    <div className="bg-surface border border-border-strong rounded-xl p-4 reveal-up">
      <div className="flex gap-3">
        <Link href={`/profile/${comment.author_id}`} className="shrink-0">
          <span
            className="inline-flex shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground font-sans font-semibold text-sm"
            style={{ width: 36, height: 36 }}
          >
            {authorName.charAt(0).toUpperCase()}
          </span>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/profile/${comment.author_id}`}
              className="font-display text-body-sm font-medium text-text-primary hover:underline truncate"
            >
              {authorName}
            </Link>
            <span className="font-sans text-caption text-text-secondary">@{handle}</span>
            <span className="font-sans text-caption text-text-secondary">·</span>
            <span className="font-sans text-caption text-text-secondary">
              {getRelativeTimeShort(comment.created_at)}
            </span>
          </div>
          <p className="mt-1 font-sans text-body-sm text-text-primary leading-relaxed">
            {comment.content}
          </p>
          <div className="mt-2 flex items-center gap-4 font-sans text-caption text-text-secondary">
            <Link
              href={`/post/${comment.post_id}`}
              className="flex items-center gap-1 hover:text-accent transition-colors"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              View post
            </Link>
            {comment.like_count > 0 && (
              <span className="flex items-center gap-1">
                <Heart className="h-3.5 w-3.5" />
                {comment.like_count}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const MediaTab: React.FC<{ userId: string }> = ({ userId }) => {
  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchMedia = useCallback(async (c: string | null, append: boolean) => {
    if (c) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/users/${userId}/media`, {
        params: { cursor: c, limit: 20 },
      });
      const data = res.data as { items: PostData[]; next_cursor: string | null; has_more: boolean };
      setPosts((prev) => (append ? [...prev, ...data.items] : data.items));
      setCursor(data.next_cursor);
      setHasMore(data.has_more);
    } catch {
      setError("Couldn't load media. Try again.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [userId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchMedia(null, false);
  }, [fetchMedia]);

  if (error) {
    return (
      <>
        <ProfileTabs active="media" onChange={() => {}} />
        <FeedErrorState message={error} onRetry={() => void fetchMedia(null, false)} />
      </>
    );
  }

  if (loading) {
    return (
      <>
        <ProfileTabs active="media" onChange={() => {}} />
        <FeedSkeletonList count={3} />
      </>
    );
  }

  if (posts.length === 0) {
    return (
      <>
        <ProfileTabs active="media" onChange={() => {}} />
        <EmptyState
          icon={<MessageCircle className="h-6 w-6" />}
          title="No media posts"
          description="This user hasn't posted any media yet."
        />
      </>
    );
  }

  return (
    <>
      <ProfileTabs active="media" onChange={() => {}} />
      <div className="divide-y divide-border-strong">
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onPostDeleted={() => setPosts((prev) => prev.filter((p) => p.id !== post.id))}
          />
        ))}
        {hasMore && (
          <div className="flex justify-center py-6">
            <button
              onClick={() => void fetchMedia(cursor, true)}
              disabled={loadingMore}
              className="font-sans text-body-sm text-text-tertiary hover:text-text-secondary transition-colors"
            >
              {loadingMore ? "Loading..." : "Load more"}
            </button>
          </div>
        )}
      </div>
    </>
  );
};

const LikesTab: React.FC<{ userId: string }> = ({ userId }) => {
  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchLikes = useCallback(async (c: string | null, append: boolean) => {
    if (c) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/users/${userId}/likes`, {
        params: { cursor: c, limit: 20 },
      });
      const data = res.data as { items: PostData[]; next_cursor: string | null; has_more: boolean };
      setPosts((prev) => (append ? [...prev, ...data.items] : data.items));
      setCursor(data.next_cursor);
      setHasMore(data.has_more);
    } catch {
      setError("Couldn't load likes. Try again.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [userId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchLikes(null, false);
  }, [fetchLikes]);

  if (error) {
    return (
      <>
        <ProfileTabs active="likes" onChange={() => {}} />
        <FeedErrorState message={error} onRetry={() => void fetchLikes(null, false)} />
      </>
    );
  }

  if (loading) {
    return (
      <>
        <ProfileTabs active="likes" onChange={() => {}} />
        <FeedSkeletonList count={3} />
      </>
    );
  }

  if (posts.length === 0) {
    return (
      <>
        <ProfileTabs active="likes" onChange={() => {}} />
        <EmptyState
          icon={<Heart className="h-6 w-6" />}
          title="No liked posts"
          description="This user hasn't liked any posts yet."
        />
      </>
    );
  }

  return (
    <>
      <ProfileTabs active="likes" onChange={() => {}} />
      <div className="divide-y divide-border-strong">
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onPostDeleted={() => setPosts((prev) => prev.filter((p) => p.id !== post.id))}
          />
        ))}
        {hasMore && (
          <div className="flex justify-center py-6">
            <button
              onClick={() => void fetchLikes(cursor, true)}
              disabled={loadingMore}
              className="font-sans text-body-sm text-text-tertiary hover:text-text-secondary transition-colors"
            >
              {loadingMore ? "Loading..." : "Load more"}
            </button>
          </div>
        )}
      </div>
    </>
  );
};

const RepostsTab: React.FC<{ userId: string }> = ({ userId }) => {
  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchReposts = useCallback(async (c: string | null, append: boolean) => {
    if (c) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/users/${userId}/reposts`, {
        params: { cursor: c, limit: 20 },
      });
      const data = res.data as { items: PostData[]; next_cursor: string | null; has_more: boolean };
      setPosts((prev) => (append ? [...prev, ...data.items] : data.items));
      setCursor(data.next_cursor);
      setHasMore(data.has_more);
    } catch {
      setError("Couldn't load reposts. Try again.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [userId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchReposts(null, false);
  }, [fetchReposts]);

  if (error) {
    return (
      <>
        <ProfileTabs active="reposts" onChange={() => {}} />
        <FeedErrorState message={error} onRetry={() => void fetchReposts(null, false)} />
      </>
    );
  }

  if (loading) {
    return (
      <>
        <ProfileTabs active="reposts" onChange={() => {}} />
        <FeedSkeletonList count={3} />
      </>
    );
  }

  if (posts.length === 0) {
    return (
      <>
        <ProfileTabs active="reposts" onChange={() => {}} />
        <EmptyState
          icon={<Repeat2 className="h-6 w-6" />}
          title="No reposts yet"
          description="This user hasn't reposted any posts yet."
        />
      </>
    );
  }

  return (
    <>
      <ProfileTabs active="reposts" onChange={() => {}} />
      <div className="divide-y divide-border-strong">
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onPostDeleted={() => setPosts((prev) => prev.filter((p) => p.id !== post.id))}
          />
        ))}
        {hasMore && (
          <div className="flex justify-center py-6">
            <button
              onClick={() => void fetchReposts(cursor, true)}
              disabled={loadingMore}
              className="font-sans text-body-sm text-text-tertiary hover:text-text-secondary transition-colors"
            >
              {loadingMore ? "Loading..." : "Load more"}
            </button>
          </div>
        )}
      </div>
    </>
  );
};
