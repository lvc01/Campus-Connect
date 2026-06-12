"use client";

import { useState, useEffect } from "react";
import { Heart, MessageCircle, Repeat2, UserPlus, AtSign, Calendar, Bell } from "lucide-react";
import { LayoutShell } from "@/components/layout/LayoutShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/feed/EmptyState";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/context/auth-context";
import { useNotifications } from "@/context/notification-context";

const icons: Record<string, typeof Heart> = {
  like: Heart,
  comment: MessageCircle,
  repost: Repeat2,
  follow: UserPlus,
  mention: AtSign,
  event: Calendar,
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const { notifications, loading } = useNotifications();

  if (!user) return null;

  return (
    <LayoutShell>
      <PageHeader title="Notifications" />
      {loading && notifications.length === 0 ? (
        <div className="py-8 text-center text-body-sm text-text-secondary">Loading...</div>
      ) : notifications.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications" description="Activity from your campus will show up here." />
      ) : (
        <ul>
          {notifications.map((n) => {
            const Icon = icons[n.type] || Bell;
            return (
              <li
                key={n.id}
                className={`flex items-start gap-3 border-b border-border p-4 ${n.is_read ? "" : "bg-surface/60"}`}
              >
                <Icon className="mt-1 h-5 w-5 text-accent" />
                {n.actor ? (
                  <Avatar user={n.actor} size={36} />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-text-secondary">
                    <Bell className="h-4 w-4" />
                  </span>
                )}
                <p className="text-body-sm text-text-primary">
                  <span className="font-semibold">{n.actor?.profile?.display_name || n.actor?.email || "System"}</span>{" "}
                  {n.body || n.title}
                  <span className="ml-1 text-caption text-text-secondary">· {new Date(n.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </LayoutShell>
  );
}
