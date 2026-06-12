"use client";

import { Search } from "lucide-react";
import { openSearch } from "@/lib/compose-events";

export function RightRail() {
  return (
    <aside className="hidden lg:flex lg:flex-col lg:gap-4 lg:py-4">
      <button
        onClick={openSearch}
        className="sticky top-0 z-10 flex h-11 w-full items-center gap-2 rounded-full border border-border bg-surface/80 px-4 text-body-sm text-text-secondary backdrop-blur-md transition-colors hover:bg-surface"
      >
        <Search className="h-4 w-4" />
        <span>Search Campus Connect</span>
      </button>

      <footer className="px-2 text-caption text-text-secondary">
        <nav className="flex flex-wrap gap-x-2 gap-y-1">
          <a href="#" className="hover:underline">Terms</a>
          <span>·</span>
          <a href="#" className="hover:underline">Privacy</a>
          <span>·</span>
          <a href="#" className="hover:underline">Cookies</a>
        </nav>
        <p className="mt-1">© 2026 Campus Connect</p>
      </footer>
    </aside>
  );
}
