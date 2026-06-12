"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, Search, Sparkles } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { Avatar } from "@/components/Avatar";
import { openSearch } from "@/lib/compose-events";
import { ThemeToggle } from "./ThemeToggle";
import { MobileDrawer } from "./MobileDrawer";

export function MobileTopBar() {
  const { user } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  if (!user) return null;

  return (
    <>
      <header className="sticky top-0 z-30 flex h-[53px] items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-md lg:hidden">
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
        >
          <Avatar user={user} size={32} />
        </button>

        <Link href="/" className="flex items-center gap-1.5" aria-label="Home">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-accent-foreground">
            <Sparkles className="h-4 w-4" />
          </span>
        </Link>

        <div className="flex items-center gap-1">
          <button
            onClick={openSearch}
            aria-label="Search"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary hover:bg-surface hover:text-text-primary"
          >
            <Search className="h-5 w-5" />
          </button>
          <Link
            href="/notifications"
            aria-label="Notifications"
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary hover:bg-surface hover:text-text-primary"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent" />
          </Link>
          <ThemeToggle className="h-9 w-9" />
        </div>
      </header>

      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
