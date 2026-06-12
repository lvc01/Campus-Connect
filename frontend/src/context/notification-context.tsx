"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/context/auth-context";
import { apiClient } from "@/lib/api-client";
import { getWSClient } from "@/lib/websocket";

export interface NotificationData {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
  actor: { id: string; email: string; profile: { display_name: string; avatar_url: string | null } | null } | null;
}

interface NotificationContextValue {
  notifications: NotificationData[];
  unreadCount: number;
  loading: boolean;
  hasMore: boolean;
  fetchMore: () => void;
  markRead: (ids: string[]) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNotifications = useCallback(async (cursor?: string) => {
    if (!user) return;
    try {
      const params: Record<string, string> = { limit: "20" };
      if (cursor) params.cursor = cursor;
      const resp = await apiClient.get("/notifications", { params });
      const { items, unread_count, next_cursor, has_more } = resp.data;
      if (cursor) {
        setNotifications((prev) => [...prev, ...items]);
      } else {
        setNotifications(items);
      }
      setUnreadCount(unread_count);
      setNextCursor(next_cursor);
      setHasMore(has_more);
    } catch (err) {
      console.error("Failed to load notifications", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const resp = await apiClient.get("/notifications/unread-count");
      setUnreadCount(resp.data.unread_count);
    } catch {
      // Silently ignore polling errors
    }
  }, [user]);

  const fetchMore = useCallback(() => {
    if (nextCursor && !loading) {
      fetchNotifications(nextCursor);
    }
  }, [nextCursor, loading, fetchNotifications]);

  // Mark specific notifications as read
  const markRead = useCallback(async (ids: string[]) => {
    try {
      await apiClient.patch("/notifications/read", { notification_ids: ids });
      setNotifications((prev) =>
        prev.map((n) => (ids.includes(n.id) ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - ids.length));
    } catch (err) {
      console.error("Failed to mark notifications as read", err);
    }
  }, []);

  // Mark all as read
  const markAllRead = useCallback(async () => {
    try {
      await apiClient.patch("/notifications/read-all");
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all notifications as read", err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (user) {
      setLoading(true);
      fetchNotifications();
    } else {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [user, fetchNotifications]);

  // Poll for unread count every 30s
  useEffect(() => {
    if (!user) return;
    pollingRef.current = setInterval(fetchUnreadCount, 30000);
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [user, fetchUnreadCount]);

  // Listen for real-time notification events via WebSocket
  useEffect(() => {
    if (!user) return;

    const token = localStorage.getItem("cc_access_token");
    if (!token) return;

    const ws = getWSClient(token);
    ws.connect();

    const unsubNotif = ws.on("notification", () => {
      fetchNotifications();
    });

    return () => {
      unsubNotif();
    };
  }, [user, fetchNotifications]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        hasMore,
        fetchMore,
        markRead,
        markAllRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}
