"use client";

import { useState, useEffect } from "react";
import { Bookmark } from "lucide-react";
import { LayoutShell } from "@/components/layout/LayoutShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { PostCard } from "@/components/feed/PostCard";
import type { PostData } from "@/types/post";
import { EmptyState } from "@/components/feed/EmptyState";
import { useAuth } from "@/context/auth-context";
import { apiClient } from "@/lib/api-client";

export default function SavedPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    apiClient.get("/users/me/saves").then((res) => {
      const data = Array.isArray(res.data) ? res.data : res.data?.items || [];
      setPosts(data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [user]);

  if (!user) return null;

  return (
    <LayoutShell>
      <PageHeader title="Bookmarks" />
      {loading ? (
        <div className="py-8 text-center text-body-sm text-text-secondary">Loading...</div>
      ) : posts.length === 0 ? (
        <EmptyState icon={Bookmark} title="No saved posts" description="Tap the bookmark icon on any post to save it here." />
      ) : (
        posts.map((p) => <PostCard key={p.id} post={p} />)
      )}
    </LayoutShell>
  );
}
