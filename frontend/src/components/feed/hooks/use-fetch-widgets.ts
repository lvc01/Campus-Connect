"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import type { ActiveAdData } from "@/types/ads";
import type { EventData } from "@/types/events";

export interface UseFetchWidgetsResult {
  events: EventData[];
  eventsLoading: boolean;
  eventsError: boolean;
  activeAd: ActiveAdData | null;
}

/**
 * Fetches the right-rail widgets: upcoming events and the active ad.
 * Non-blocking — if either fails, the others still render.
 */
export function useFetchWidgets(enabled = true): UseFetchWidgetsResult {
  const [events, setEvents] = useState<EventData[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState(false);
  const [activeAd, setActiveAd] = useState<ActiveAdData | null>(null);

  useEffect(() => {
    if (!enabled) {
      const task = window.setTimeout(() => setEventsLoading(false), 0);
      return () => window.clearTimeout(task);
    }

    let cancelled = false;
    const task = window.setTimeout(() => {
      setEventsLoading(true);
      setEventsError(false);
    }, 0);

    const fetchAll = async () => {
      const [eventsRes, adRes] = await Promise.allSettled([
        apiClient.get<EventData[]>("/events", { params: { status: "upcoming", limit: 3 } }),
        apiClient.get<ActiveAdData | null>("/ads/active"),
      ]);

      if (cancelled) return;

      if (eventsRes.status === "fulfilled") {
        setEvents(eventsRes.value.data.slice(0, 3));
      } else {
        setEventsError(true);
      }

      if (adRes.status === "fulfilled") {
        setActiveAd(adRes.value.data || null);
      }

      setEventsLoading(false);
    };

    const fetchTask = window.setTimeout(() => {
      void fetchAll();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(task);
      window.clearTimeout(fetchTask);
    };
  }, [enabled]);

  return { events, eventsLoading, eventsError, activeAd };
}
