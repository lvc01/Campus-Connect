"use client";

import React from "react";
import { Bell, Heart, MessageCircle, Send, UserPlus } from "lucide-react";
import { NotificationData } from "@/context/notification-context";
import { getInitials, getRelativeTime } from "@/lib/utils";
import { RoleBadge } from "@/components/RoleBadge";
import Link from "next/link";

function NotificationIcon({ type }: { type: string }) {
  switch (type) {
    case "like":
      return <Heart className="h-4 w-4 fill-current text-like" />;
    case "comment":
      return <MessageCircle className="h-4 w-4 text-indigo-400" strokeWidth={2} />;
    case "dm":
      return <Send className="h-4 w-4 text-emerald-400" strokeWidth={2} />;
    case "follow":
      return <UserPlus className="h-4 w-4 text-sky-400" strokeWidth={2} />;
    default:
      return <Bell className="h-4 w-4 text-text-tertiary" strokeWidth={2} />;
  }
}

function getNotificationLink(type: string, data: Record<string, unknown> | null): string {
  if (!data) return "#";
  switch (type) {
    case "like":
    case "comment":
      return data.post_id ? `/saved` : "#";
    case "dm":
      return data.conversation_id ? `/messages` : "#";
    default:
      return "#";
  }
}

interface NotificationItemProps {
  notification: NotificationData;
  onMarkRead: (id: string) => void;
  isDropdown?: boolean;
}

export function NotificationItem({ notification, onMarkRead, isDropdown = true }: NotificationItemProps) {
  const link = getNotificationLink(notification.type, notification.data);

  const inner = (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg transition-colors duration-200 cursor-pointer ${
        !notification.is_read
          ? "bg-accent/5 border-l-2 border-l-accent"
          : "hover:bg-[rgba(var(--bg-hover),0.08)] border-l-2 border-transparent"
      }`}
      onClick={() => {
        if (!notification.is_read) onMarkRead(notification.id);
      }}
    >
      <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shrink-0 shadow-sm">
        {notification.actor ? (
          <span className="text-xs font-bold text-accent-foreground">{getInitials(notification.actor.profile?.display_name || "")}</span>
        ) : (
          <NotificationIcon type={notification.type} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-sm leading-snug ${!notification.is_read ? "font-semibold text-text-primary" : "text-text-primary"}`}>
          {notification.title}
          {notification.actor?.role && (
            <>
              {" "}
              <RoleBadge role={notification.actor.role} hideStudent size={11} />
            </>
          )}
        </p>
        {notification.body && (
          <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">{notification.body}</p>
        )}
        <p className="text-[10px] font-medium text-text-tertiary mt-1">{getRelativeTime(notification.created_at)}</p>
      </div>
      {!notification.is_read && (
        <div className="w-2 h-2 rounded-full bg-accent shrink-0 mt-1.5" />
      )}
    </div>
  );

  if (isDropdown && link !== "#") {
    return <Link href={link}>{inner}</Link>;
  }

  return inner;
}
