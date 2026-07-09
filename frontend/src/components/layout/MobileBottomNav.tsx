"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { mobileNavItems } from "./nav-config";
import { openCompose } from "@/lib/compose-events";
import { cn } from "@/lib/utils";

export function MobileBottomNav() {
  const pathname = usePathname();
  const isActive = (to: string) =>
    to === "/" ? pathname === "/" : pathname.startsWith(to);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 grid grid-cols-4 border-t border-border bg-background/90 backdrop-blur-md lg:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      {mobileNavItems.map((item) => {
        const active = isActive(item.to);
        const inner = (
          <span className="relative">
            <item.icon
              className={cn("h-6 w-6", active ? "text-accent" : "text-text-secondary")}
            />
            {item.badge ? (
              <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-foreground">
                {item.badge}
              </span>
            ) : null}
          </span>
        );
        return (
          <Link
            key={item.label}
            href={item.to}
            className="flex items-center justify-center"
            aria-label={item.label}
          >
            {inner}
          </Link>
        );
      })}
      <button
        onClick={openCompose}
        className="flex items-center justify-center"
        aria-label="Compose post"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-sm">
          <Plus className="h-5 w-5" />
        </span>
      </button>
    </nav>
  );
}
