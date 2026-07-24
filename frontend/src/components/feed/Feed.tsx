"use client";

import { useCallback, useEffect, useState } from "react";
import NextLink from "next/link";
import { Inbox } from "lucide-react";
import { PostCard } from "./PostCard";
import type { PostData } from "@/types/post";
import { AdCard } from "./AdCard";
import { FeedSkeletonList } from "./feed-skeleton-list";
import { apiClient } from "@/lib/api-client";

interface FeedProps {
  tab: "foryou" | "faculty";
}

export function Feed({ tab }: FeedProps) {
  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const SKELETON_COUNT = 6;

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | boolean> = {};
      if (tab === "faculty") params.faculty_only = true;
      const res = await apiClient.get("/posts", { params });
      const data = Array.isArray(res.data) ? res.data : res.data?.items || [];
      setPosts(data);
    } catch {
      // error
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
    fetchPosts();
  }, [fetchPosts]);

  if (loading) {
    return <FeedSkeletonList count={SKELETON_COUNT} />;
  }

  const visible = posts.slice(0, page * PAGE_SIZE);

  if (visible.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center animate-pop-in">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface text-text-secondary">
          <Inbox className="h-7 w-7" />
        </span>
        <h3 className="mt-4 font-display text-h2 font-medium text-text-primary leading-tight">
          Your campus, soon to be loud.
        </h3>
        <p className="mt-1.5 text-body-sm text-text-secondary max-w-[360px] leading-relaxed">
          Join a few clubs or post what&apos;s happening on campus to start your feed.
        </p>
        <NextLink
          href="/clubs"
          className="mt-6 inline-flex items-center rounded-full bg-accent px-5 py-2 font-sans text-body-sm font-semibold text-accent-foreground transition-all hover:bg-accent-press hover:shadow-md hover:shadow-accent/25 active:scale-95"
        >
          Browse clubs
        </NextLink>
      </div>
    );
  }

  return (
    <div>
      {visible.map((post, i) => (
        <div
          key={post.id}
          className={i < 6 ? "reveal-up" : undefined}
          style={i < 6 ? { animationDelay: `${Math.min(i * 60, 360)}ms` } : undefined}
        >
          <PostCard
            post={post}
            onPostDeleted={() => {
              setPosts((prev) => prev.filter((p) => p.id !== post.id));
            }}
          />
          {(i + 1) % 10 === 0 && i > 0 && (
            <AdCard sponsor="Campus Connect" headline="Join the campus community and stay connected!" />
          )}
        </div>
      ))}
      {visible.length < posts.length && (
        <div className="py-6 text-center">
          <button
            onClick={() => setPage((p) => p + 1)}
            className="font-sans text-caption text-text-secondary transition-colors hover:text-accent"
          >
            Load more
          </button>
        </div>
      )}
    </div>
  );
}

