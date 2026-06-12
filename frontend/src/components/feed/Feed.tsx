"use client";

import { useCallback, useEffect, useState } from "react";
import { Inbox } from "lucide-react";
import { PostCard } from "./PostCard";
import type { PostData } from "@/types/post";
import { AdCard } from "./AdCard";
import { EmptyState } from "./EmptyState";
import { apiClient } from "@/lib/api-client";

interface FeedProps {
  tab: "foryou" | "faculty";
}

export function Feed({ tab }: FeedProps) {
  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

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
    setPage(1);
    fetchPosts();
  }, [fetchPosts]);

  if (loading) {
    return (
      <div className="py-8 text-center text-body-sm text-text-secondary">
        Loading posts...
      </div>
    );
  }

  const visible = posts.slice(0, page * PAGE_SIZE);

  if (visible.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="No posts yet"
        description="Be the first to share something with your campus community."
      />
    );
  }

  return (
    <div>
      {visible.map((post, i) => (
        <div
          key={post.id}
          className="animate-fade-in"
          style={{ animationDelay: `${Math.min(i * 40, 300)}ms` }}
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
        <div className="py-4 text-center">
          <button
            onClick={() => setPage((p) => p + 1)}
            className="text-body-sm font-semibold text-accent hover:opacity-80 transition-opacity"
          >
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
