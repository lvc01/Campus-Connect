"use client";

import { cn } from "@/lib/utils";

interface FeedTabsProps {
  value: "foryou" | "faculty";
  onChange: (tab: "foryou" | "faculty") => void;
}

export function FeedTabs({ value, onChange }: FeedTabsProps) {
  return (
    <div className="sticky top-[52px] z-10 flex border-b border-border bg-background/80 backdrop-blur-md lg:sticky lg:top-0">
      <button
        onClick={() => onChange("foryou")}
        className={cn(
          "flex-1 py-3 text-body-sm font-semibold transition-all duration-200",
          value === "foryou"
            ? "border-b-2 border-accent text-text-primary"
            : "border-b-2 border-transparent text-text-secondary hover:text-text-primary",
        )}
      >
        For You
      </button>
      <button
        onClick={() => onChange("faculty")}
        className={cn(
          "flex-1 py-3 text-body-sm font-semibold transition-all duration-200",
          value === "faculty"
            ? "border-b-2 border-accent text-text-primary"
            : "border-b-2 border-transparent text-text-secondary hover:text-text-primary",
        )}
      >
        Faculty
      </button>
    </div>
  );
}
