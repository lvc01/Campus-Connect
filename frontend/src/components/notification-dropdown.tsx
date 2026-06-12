"use client";

import React, { useRef, useEffect } from "react";
import { Bell, X } from "lucide-react";
import { useNotifications } from "@/context/notification-context";
import { NotificationItem } from "@/components/notification-item";
import Link from "next/link";

interface NotificationDropdownProps {
  onClose: () => void;
}

export function NotificationDropdown({ onClose }: NotificationDropdownProps) {
  const { notifications, loading, unreadCount, markRead, markAllRead } = useNotifications();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const handleMarkRead = (id: string) => {
    markRead([id]);
  };

  return (
    <div
      ref={dropdownRef}
      className="absolute top-full right-0 mt-2 w-80 sm:w-96 bg-bg-surface border border-border shadow-2xl shadow-black/50 z-50 overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-bold text-text-primary">Notifications</h3>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="text-[11px] font-semibold text-accent hover:underline transition-colors"
            >
              Mark all read
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close notifications"
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto scrollbar-thin">
        {loading ? (
          <div className="p-4 space-y-3 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3 items-start">
                <div className="w-8 h-8 bg-bg-elevated rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-bg-elevated rounded w-3/4" />
                  <div className="h-2 bg-bg-elevated rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center">
            <Bell className="h-8 w-8 text-text-muted mx-auto mb-3" strokeWidth={2} />
            <p className="text-sm text-text-secondary">No notifications yet</p>
            <p className="text-xs text-text-muted mt-1">When someone interacts with your content, it will appear here.</p>
          </div>
        ) : (
          <div className="p-2">
            {notifications.slice(0, 10).map((n) => (
              <NotificationItem key={n.id} notification={n} onMarkRead={handleMarkRead} />
            ))}
          </div>
        )}
      </div>

      {notifications.length > 0 && (
        <div className="border-t border-border px-4 py-2.5">
          <Link
            href="/notifications"
            onClick={onClose}
            className="block text-center text-xs font-semibold text-accent hover:underline transition-colors"
          >
            See all notifications →
          </Link>
        </div>
      )}
    </div>
  );
}
