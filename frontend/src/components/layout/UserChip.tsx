"use client";

import Link from "next/link";
import { LogOut } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { Avatar } from "@/components/Avatar";
import { cn } from "@/lib/utils";

export function UserChip({
  collapsed = false,
  className,
}: {
  collapsed?: boolean;
  className?: string;
}) {
  const { user, logout } = useAuth();
  if (!user) return null;

  const displayName = user.profile?.display_name || user.email;

  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-surface",
        className,
      )}
    >
      <Link href={`/profile/${user.id}`} className="flex items-center gap-3 min-w-0 flex-1">
        <Avatar user={user} size={36} />
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-text-primary">
              {displayName}
            </p>
            <p className="truncate text-xs text-text-secondary">
              @{user.email?.split("@")[0]}
            </p>
          </div>
        )}
      </Link>
      {!collapsed && (
        <button
          onClick={logout}
          aria-label="Log out"
          className="text-text-secondary opacity-0 transition-opacity hover:text-text-primary group-hover:opacity-100 shrink-0"
        >
          <LogOut className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
