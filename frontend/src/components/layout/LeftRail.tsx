"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Plus, Shield } from "lucide-react";
import { navItems } from "./nav-config";
import { useAuth } from "@/context/auth-context";
import { apiClient } from "@/lib/api-client";
import { openCompose, openSearch } from "@/lib/compose-events";
import { ThemeToggle } from "./ThemeToggle";
import { UserChip } from "./UserChip";
import { cn } from "@/lib/utils";

export function LeftRail() {
  const { user } = useAuth();
  const pathname = usePathname();
  const isAdmin = user?.role === "admin";
  const isModerator = user?.role === "moderator" || user?.role === "university_staff";
  const [pendingReports, setPendingReports] = useState(0);

  useEffect(() => {
    if (!isModerator) return;
    const fetchPending = async () => {
      try {
        const res = await apiClient.get("/moderation/pending-count");
        setPendingReports(res.data.pending || 0);
      } catch {
        // Silently fail — badge is non-critical
      }
    };
    fetchPending();
    const interval = setInterval(fetchPending, 60000);
    return () => clearInterval(interval);
  }, [isModerator]);

  const isActive = (to: string, isSearch?: boolean) =>
    !isSearch && (to === "/" ? pathname === "/" : pathname.startsWith(to));

  const items = navItems.map((item) => {
    if (item.label === "Moderation" && pendingReports > 0) {
      return { ...item, badge: pendingReports };
    }
    return item;
  });

  return (
    <aside className="sticky top-0 hidden h-screen flex-col gap-1 py-4 lg:flex">
      <Link
        href="/"
        className="mb-2 flex h-10 items-center gap-2 px-2 xl:px-3"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent overflow-hidden">
          <Image
            src="/logo-white.png"
            alt="Campus Connect"
            width={36}
            height={36}
            className="object-contain"
          />
        </span>
        <span className="hidden text-h3 font-bold text-text-primary xl:inline">
          Campus Connect
        </span>
      </Link>

      <nav className="flex flex-col gap-1">
        {items.map((item) => {
          const active = isActive(item.to, item.isSearch);
          const content = (
            <>
              <span className="relative">
                <item.icon
                  className={cn("h-[22px] w-[22px]", active && "stroke-[2.5]")}
                />
                {item.badge ? (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-foreground">
                    {item.badge}
                  </span>
                ) : null}
              </span>
              <span className="hidden xl:inline">{item.label}</span>
            </>
          );

          const classes = cn(
            "flex h-10 items-center gap-3 rounded-lg px-2 xl:px-3 text-body transition-colors",
            active
              ? "font-bold text-text-primary"
              : "text-text-secondary hover:bg-surface hover:text-text-primary",
          );

          if (item.isSearch) {
            return (
              <button
                key={item.label}
                onClick={openSearch}
                className={cn(classes, "w-full text-left")}
              >
                {content}
              </button>
            );
          }

          return (
            <Link key={item.label} href={item.to} className={classes}>
              {content}
            </Link>
          );
        })}

        {isAdmin && (
          <Link
            href="/admin"
            className={cn(
              "flex h-10 items-center gap-3 rounded-lg px-2 xl:px-3 text-body transition-colors",
              isActive("/admin")
                ? "font-bold text-text-primary"
                : "text-text-secondary hover:bg-surface hover:text-text-primary",
            )}
          >
            <Shield className="h-[22px] w-[22px]" />
            <span className="hidden xl:inline">Admin</span>
          </Link>
        )}
      </nav>

      <button
        onClick={openCompose}
        className="mt-3 flex h-11 w-11 items-center justify-center gap-2 self-center rounded-full bg-accent font-semibold text-accent-foreground shadow-sm transition-all duration-200 hover:opacity-90 hover:shadow-md hover:shadow-accent/20 active:scale-95 xl:w-full xl:self-stretch"
      >
        <Plus className="h-5 w-5" />
        <span className="hidden xl:inline">Post</span>
      </button>

      <div className="mt-auto flex flex-col gap-1 pt-3">
        <ThemeToggle />
        <UserChip collapsed className="xl:hidden" />
        <UserChip className="hidden xl:flex" />
      </div>
    </aside>
  );
}
