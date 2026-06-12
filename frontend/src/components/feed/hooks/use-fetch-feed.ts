"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { apiClient } from "@/lib/api-client";
import { useIntersectionObserver } from "@/hooks/use-intersection";
import type { PostData } from "@/types/post";

export interface UseFetchFeedOptions {
  facultyOnly?: boolean;
  authorId?: string;
  enableRefreshEvent?: boolean;
  endpoint?: string;
  limit?: number;
}

export interface UseFetchFeedResult {
  posts: PostData[];
  isLoading: boolean;
  isMoreLoading: boolean;
  hasMore: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  fetchMore: () => Promise<void>;
  prepend: (post: PostData) => void;
  replace: (post: PostData) => void;
  remove: (postId: string) => void;
  loaderRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Fetches the home feed with cursor pagination and a refresh event listener
 * (window event: "feed:refresh"). Returns a `loaderRef` to attach to the
 * sentinel element at the bottom of the list — when it intersects, more
 * posts are fetched.
 */
export function useFetchFeed(options: UseFetchFeedOptions = {}): UseFetchFeedResult {
  const {
    facultyOnly = false,
    authorId,
    enableRefreshEvent = true,
    endpoint = "/posts",
    limit = 10,
  } = options;

  const [posts, setPosts] = useState<PostData[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isMoreLoading, setIsMoreLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loaderRef = useRef<HTMLDivElement | null>(null);

  const fetchPage = useCallback(
    async (cursor: string | null, append: boolean, signal?: AbortSignal) => {
      if (cursor) {
        setIsMoreLoading(true);
      } else {
        setIsLoading(true);
      }
      setError(null);
      try {
        const response = await apiClient.get(endpoint, {
          signal,
          params: {
            cursor,
            limit,
            faculty_only: facultyOnly,
            ...(authorId ? { author_id: authorId } : {}),
          },
        });
        const { items, next_cursor, has_more } = response.data as {
          items: PostData[];
          next_cursor: string | null;
          has_more: boolean;
        };
        setPosts((prev) => (append ? [...prev, ...items] : items));
        setNextCursor(next_cursor);
        setHasMore(has_more);
      } catch (err: unknown) {
        if (axios.isCancel(err)) return;
        const status =
          typeof err === "object" && err && "response" in err
            ? (err as { response?: { status?: number } }).response?.status
            : undefined;
        setError(
          status === 401
            ? "Session expired. Please log in again."
            : "Couldn't load feed. Check your connection and try again.",
        );
      } finally {
        setIsLoading(false);
        setIsMoreLoading(false);
      }
    },
    [limit, facultyOnly, authorId, endpoint],
  );

  const refresh = useCallback(async () => {
    await fetchPage(null, false);
  }, [fetchPage]);

  const fetchMore = useCallback(async () => {
    if (!hasMore || isMoreLoading) return;
    await fetchPage(nextCursor, true);
  }, [fetchPage, hasMore, isMoreLoading, nextCursor]);

  // Initial load + refetch when filters change
  useEffect(() => {
    const controller = new AbortController();
    void fetchPage(null, false, controller.signal);
    return () => controller.abort();
  }, [fetchPage]);

  // Window refresh event (opt-in; off for profile/club feeds)
  useEffect(() => {
    if (!enableRefreshEvent) return;
    const handler = () => {
      void fetchPage(null, false);
    };
    window.addEventListener("feed:refresh", handler);
    return () => window.removeEventListener("feed:refresh", handler);
  }, [fetchPage, enableRefreshEvent]);

  // Intersection observer for pagination
  useIntersectionObserver(
    loaderRef,
    () => {
      if (hasMore && !isMoreLoading) void fetchMore();
    },
    hasMore && !isLoading && !isMoreLoading,
  );

  const prepend = useCallback((post: PostData) => {
    setPosts((prev) => [post, ...prev]);
  }, []);

  const replace = useCallback((post: PostData) => {
    setPosts((prev) => prev.map((p) => (p.id === post.id ? post : p)));
  }, []);

  const remove = useCallback((postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }, []);

  return {
    posts,
    isLoading,
    isMoreLoading,
    hasMore,
    error,
    refresh,
    fetchMore,
    prepend,
    replace,
    remove,
    loaderRef,
  };
}
