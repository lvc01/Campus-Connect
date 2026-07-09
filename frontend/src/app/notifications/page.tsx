"use client";

import { useRouter } from "next/navigation";
import {
  Heart,
  MessageCircle,
  Repeat2,
  UserPlus,
  AtSign,
  Calendar,
  Bell,
  CheckCheck,
  Users,
  MessageSquare,
  Flag,
  CheckCircle,
  AlertCircle,
  Clock,
} from "lucide-react";
import { LayoutShell } from "@/components/layout/LayoutShell";
import { EmptyState } from "@/components/feed/EmptyState";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/context/auth-context";
import { useNotifications } from "@/context/notification-context";
import { cn } from "@/lib/utils";
import type { NotificationData } from "@/context/notification-context";

// Each type maps to a Tailwind palette class pair (text + /10 background).
// Opacity-based backgrounds adapt to light and dark themes — unlike the old
// hardcoded light-hex backgrounds, which rendered as glaring light circles
// in dark mode.
const NOTIFICATION_CONFIG: Record<
  string,
  { icon: typeof Heart; className: string }
> = {
  like: { icon: Heart, className: "text-rose-500 bg-rose-500/10" },
  comment: { icon: MessageCircle, className: "text-blue-500 bg-blue-500/10" },
  repost: { icon: Repeat2, className: "text-emerald-500 bg-emerald-500/10" },
  follow: { icon: UserPlus, className: "text-violet-500 bg-violet-500/10" },
  mention: { icon: AtSign, className: "text-amber-500 bg-amber-500/10" },
  event: { icon: Calendar, className: "text-cyan-500 bg-cyan-500/10" },
  event_reminder: { icon: Clock, className: "text-orange-500 bg-orange-500/10" },
  dm: { icon: MessageSquare, className: "text-indigo-500 bg-indigo-500/10" },
  club_announcement: { icon: Users, className: "text-teal-500 bg-teal-500/10" },
  report_resolved: { icon: CheckCircle, className: "text-emerald-500 bg-emerald-500/10" },
  report_new: { icon: Flag, className: "text-rose-500 bg-rose-500/10" },
  system: { icon: AlertCircle, className: "text-text-secondary bg-surface" },
};

function getNotificationRoute(n: NotificationData): string | null {
  const data = n.data;
  if (!data) return null;

  switch (n.type) {
    case "like":
    case "comment":
    case "repost":
    case "mention":
      return data.post_id ? `/posts/${data.post_id}` : null;
    case "follow":
      return n.actor?.id ? `/profile/${n.actor.id}` : null;
    case "event":
    case "event_reminder":
      return data.event_id ? `/events/${data.event_id}` : null;
    case "dm":
      return "/messages";
    case "club_announcement":
      if (data.club_slug) return `/clubs/${data.club_slug}`;
      if (data.post_id) return `/posts/${data.post_id}`;
      if (data.club_id) return `/clubs/${data.club_id}`;
      return null;
    case "report_new":
    case "report_resolved":
    case "system":
      return null;
    default:
      return null;
  }
}

function getRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// Collapse repeated actor-driven notifications on the same post into one row
// ("X and N others liked your post"). Other types stay individual.
const GROUP_VERB: Record<string, string> = {
  like: "liked your post",
  repost: "reposted your post",
  comment: "commented on your post",
};

interface NotifGroup {
  key: string;
  items: NotificationData[];
}

function buildGroups(ns: NotificationData[]): NotifGroup[] {
  const groups: NotifGroup[] = [];
  const index = new Map<string, NotifGroup>();
  for (const n of ns) {
    const pid = n.data && n.data.post_id != null ? String(n.data.post_id) : "";
    const groupable = !!pid && (n.type === "like" || n.type === "repost" || n.type === "comment");
    const key = groupable ? `${n.type}:${pid}` : `single:${n.id}`;
    let g = index.get(key);
    if (!g) {
      g = { key, items: [] };
      index.set(key, g);
      groups.push(g);
    }
    g.items.push(n);
  }
  return groups;
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const { notifications, loading, hasMore, fetchMore, markRead, markAllRead } =
    useNotifications();
  const router = useRouter();

  const unreadNotifications = notifications.filter((n) => !n.is_read);

  const handleGroupClick = async (items: NotificationData[]) => {
    const unreadIds = items.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length) await markRead(unreadIds);
    const route = getNotificationRoute(items[0]);
    if (route) router.push(route);
  };

  const handleMarkAllRead = async () => {
    await markAllRead();
  };

  if (!user) return null;

  return (
    <LayoutShell>
      <div className="flex items-center justify-between px-6 pt-4 pb-2">
        <h1 className="font-display text-h1 font-medium text-text-primary">Notifications</h1>
        {unreadNotifications.length > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent/80 transition-colors"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Read all
          </button>
        )}
      </div>

      {loading && notifications.length === 0 ? (
        <div className="py-8 text-center text-sm text-text-secondary">
          Loading...
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications"
          description="Activity from your campus will show up here."
        />
      ) : (
        <ul>
          {buildGroups(notifications).map((group) => {
            const items = group.items;
            const n = items[0];
            const grouped = items.length > 1;
            const config = NOTIFICATION_CONFIG[n.type] || NOTIFICATION_CONFIG.system;
            const Icon = config.icon;
            const route = getNotificationRoute(n);
            const isClickable = !!route;
            const anyUnread = items.some((it) => !it.is_read);
            const actorName = n.actor?.profile?.display_name || n.actor?.email || "System";

            return (
              <li key={group.key}>
                <button
                  onClick={() => handleGroupClick(items)}
                  disabled={!isClickable}
                  className={cn(
                    "w-full flex items-start gap-3 border-b border-border-quiet p-4 text-left transition-colors",
                    isClickable && "hover:bg-surface/60 active:bg-surface/80",
                    anyUnread && "bg-surface/40"
                  )}
                >
                  {/* Actor avatar with overlaid type-icon badge (mobile style) */}
                  <div className="relative shrink-0">
                    {n.actor ? (
                      <Avatar user={n.actor} size={40} />
                    ) : (
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-text-secondary">
                        <Bell className="h-5 w-5" />
                      </span>
                    )}
                    <span
                      className={cn(
                        "absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-background",
                        config.className,
                      )}
                    >
                      <Icon className="h-3 w-3" />
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary leading-snug">
                      <span className="font-semibold">{actorName}</span>{" "}
                      {grouped ? (
                        <>
                          and {items.length - 1} {items.length - 1 === 1 ? "other" : "others"}{" "}
                          {GROUP_VERB[n.type] || n.body || n.title}
                        </>
                      ) : (
                        n.body || n.title
                      )}
                    </p>
                    <p className="text-xs text-text-secondary mt-1">
                      {getRelativeTime(n.created_at)}
                    </p>
                  </div>

                  {/* Unread dot */}
                  {anyUnread && (
                    <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-accent" />
                  )}
                </button>
              </li>
            );
          })}

          {hasMore && (
            <li className="py-4 text-center">
              <button
                onClick={fetchMore}
                className="text-sm font-semibold text-accent hover:text-accent/80 transition-colors"
              >
                Load more
              </button>
            </li>
          )}
        </ul>
      )}
    </LayoutShell>
  );
}
