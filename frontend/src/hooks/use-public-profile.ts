"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import type { PublicProfileData } from "@/types/user";

export interface UsePublicProfileResult {
  profile: PublicProfileData | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function usePublicProfile(userId: string | null | undefined): UsePublicProfileResult {
  const [profile, setProfile] = useState<PublicProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!userId) {
      const task = window.setTimeout(() => setIsLoading(false), 0);
      return () => window.clearTimeout(task);
    }

    let cancelled = false;
    const initTask = window.setTimeout(() => {
      setIsLoading(true);
      setError(null);
    }, 0);

    const fetch = async () => {
      try {
        const res = await apiClient.get<PublicProfileData>(`/users/${userId}/profile`);
        if (cancelled) return;
        setProfile(res.data);
      } catch (err: unknown) {
        if (cancelled) return;
        const status =
          typeof err === "object" && err && "response" in err
            ? (err as { response?: { status?: number } }).response?.status
            : undefined;
        setError(
          status === 404
            ? "User not found"
            : "Couldn't load this profile. Please try again.",
        );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    const fetchTask = window.setTimeout(() => {
      void fetch();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(initTask);
      window.clearTimeout(fetchTask);
    };
  }, [userId, tick]);

  return { profile, isLoading, error, refresh };
}
