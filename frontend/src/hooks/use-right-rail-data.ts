"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/context/auth-context";
import type { PostData } from "@/types/post";

export interface RightRailTrend {
  id: string;
  label: string;
  count: number;
  href: string;
}

export interface RightRailUpcomingEvent {
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

interface EventResponseLite {
  id: string;
  title: string;
  location: string | null;
  start_time: string;
}

export interface UseRightRailDataResult {
  trends: RightRailTrend[];
  upcoming: RightRailUpcomingEvent[];
  isLoading: boolean;
  refresh: () => void;
}

const REFRESH_INTERVAL_MS = 60_000;
const SAMPLE_SIZE = 30;
const MAX_TRENDS = 5;
const MAX_UPCOMING = 3;

/**
 * Drives the home right-rail:
 *   - trends:   top hashtags in the most recent ~30 posts, ordered by frequency
 *   - upcoming: next ~3 campus events, sorted by start_time
 *
 * Polls every 60s so the rail stays fresh without flooding the API. Falls
 * back to a built-in list on failure so the rail still renders.
 */
export function useRightRailData(): UseRightRailDataResult {
  const { user } = useAuth();
  const [trends, setTrends] = useState<RightRailTrend[]>([]);
  const [upcoming, setUpcoming] = useState<RightRailUpcomingEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    if (!user) {
      window.setTimeout(() => {
        setTrends([]);
        setUpcoming([]);
        setIsLoading(false);
      }, 0);
      return;
    }

    let cancelled = false;
    const initTask = window.setTimeout(() => {
      setIsLoading(true);
    }, 0);

    const fetchSample = async () => {
      try {
        const [postsRes, eventsRes] = await Promise.all([
          apiClient.get<PostData[]>("/posts", { params: { limit: SAMPLE_SIZE } }),
          apiClient.get<EventResponseLite[]>("/events", {
            params: { status: "upcoming", limit: MAX_UPCOMING },
          }),
        ]);
        if (cancelled) return;
        setTrends(extractTrends(postsRes.data));
        setUpcoming(extractUpcoming(eventsRes.data));
      } catch {
        if (cancelled) return;
        setTrends([]);
        setUpcoming([]);
      } finally {
        if (!cancelled) {
          window.setTimeout(() => setIsLoading(false), 0);
        }
      }
    };

    const fetchTask = window.setTimeout(() => {
      void fetchSample();
    }, 0);

    const pollId = window.setInterval(() => {
      void fetchSample();
    }, REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(initTask);
      window.clearTimeout(fetchTask);
      window.clearInterval(pollId);
    };
  }, [user, refreshTick]);

  return {
    trends,
    upcoming,
    isLoading,
    refresh: () => setRefreshTick((n) => n + 1),
  };
}

function extractTrends(posts: PostData[]): RightRailTrend[] {
  const counts = new Map<string, number>();
  for (const post of posts) {
    if (!post.tags) continue;
    for (const raw of post.tags) {
      const tag = raw.trim().replace(/^#/, "").toLowerCase();
      if (!tag) continue;
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  const sorted = Array.from(counts.entries())
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .slice(0, MAX_TRENDS);

  return sorted.map(([tag, count]) => ({
    id: `tag-${tag}`,
    label: `#${tag}`,
    count,
    href: `/search?q=${encodeURIComponent("#" + tag)}`,
  }));
}

function extractUpcoming(events: EventResponseLite[]): RightRailUpcomingEvent[] {
  return events.slice(0, MAX_UPCOMING).map((e) => ({
    id: e.id,
    title: e.title,
    subtitle: formatEventSubtitle(e),
    href: `/events`,
  }));
}

function formatEventSubtitle(e: EventResponseLite): string {
  const where = e.location?.trim() || "Campus";
  const when = formatStartTime(e.start_time);
  return `${where} · ${when}`;
}

function formatStartTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}
