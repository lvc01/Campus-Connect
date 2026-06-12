"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface TabItem {
  key: string;
  label: string;
  count?: number;
  disabled?: boolean;
}

export interface TabsBarProps {
  items: TabItem[];
  active: string;
  onChange: (key: string) => void;
  size?: "sm" | "md";
  sticky?: boolean;
  className?: string;
}

export const TabsBar: React.FC<TabsBarProps> = ({
  items,
  active,
  onChange,
  size = "md",
  sticky = false,
  className,
}) => {
  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      className={cn(
        "flex w-full border-b border-border",
        sticky && "sticky top-0 z-10 bg-bg/85 backdrop-blur-md",
        className,
      )}
    >
      {items.map((item) => {
        const isActive = item.key === active;
        return (
          <button
            key={item.key}
            role="tab"
            aria-selected={isActive}
            aria-controls={`tab-panel-${item.key}`}
            id={`tab-${item.key}`}
            tabIndex={isActive ? 0 : -1}
            disabled={item.disabled}
            onClick={() => !item.disabled && onChange(item.key)}
            className={cn(
              "group/tab relative flex-1 min-w-0 transition-colors duration-150",
              "focus:outline-none focus-visible:bg-bg-elevated",
              "hover:bg-bg-elevated/50",
              size === "sm" ? "h-10 text-sm" : "h-[48px] text-sm",
              "flex items-center justify-center font-medium",
              isActive ? "text-text-primary font-semibold" : "text-text-secondary",
              item.disabled && "opacity-50 cursor-not-allowed hover:bg-transparent",
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              {item.label}
              {item.count !== undefined && (
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    isActive ? "text-text-primary" : "text-text-secondary",
                  )}
                >
                  {item.count}
                </span>
              )}
            </span>
            <span
              aria-hidden="true"
              className={cn(
                "absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] rounded-full transition-all duration-200",
                isActive
                  ? "w-10 bg-accent"
                  : "w-0 bg-transparent group-hover/tab:bg-border-strong",
              )}
            />
          </button>
        );
      })}
    </div>
  );
};
