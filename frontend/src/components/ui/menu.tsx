"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface MenuItem {
  key: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  onSelect?: () => void;
  destructive?: boolean;
  disabled?: boolean;
  href?: string;
}

export interface MenuProps {
  trigger: React.ReactNode;
  items: MenuItem[];
  align?: "start" | "center" | "end";
  side?: "top" | "bottom";
  className?: string;
  panelClassName?: string;
}

export const Menu: React.FC<MenuProps> = ({
  trigger,
  items,
  align = "end",
  side = "bottom",
  className,
  panelClassName,
}) => {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative inline-block", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="appearance-none bg-transparent border-0 p-0 m-0 inline-flex focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-full"
      >
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          className={cn(
            "absolute z-40 min-w-[200px] py-1.5 bg-background rounded-2xl border border-border shadow-modal",
            "animate-fade-in",
            side === "bottom" ? "top-full mt-2" : "bottom-full mb-2",
            align === "start" && "left-0",
            align === "center" && "left-1/2 -translate-x-1/2",
            align === "end" && "right-0",
            panelClassName,
          )}
        >
          {items.map((item) => {
            const content = (
              <span className="flex items-center gap-3 w-full">
                {item.icon && (
                  <span className="w-4 h-4 inline-flex items-center justify-center shrink-0">
                    {item.icon}
                  </span>
                )}
                <span className="flex-1 text-left text-sm">{item.label}</span>
              </span>
            );

            const baseItem =
              "flex items-center w-full px-3 py-2 text-sm transition-colors duration-150 focus:outline-none";
            const tone = item.destructive
              ? "text-like hover:bg-like/10"
              : "text-text-primary hover:bg-surface";
            const disabled = item.disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer";

            if (item.href) {
              return (
                <a
                  key={item.key}
                  href={item.href}
                  role="menuitem"
                  className={cn(baseItem, tone, disabled)}
                  onClick={() => setOpen(false)}
                >
                  {content}
                </a>
              );
            }
            return (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  if (item.disabled) return;
                  setOpen(false);
                  item.onSelect?.();
                }}
                className={cn(baseItem, tone, disabled)}
              >
                {content}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
