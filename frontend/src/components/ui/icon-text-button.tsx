"use client";

import React from "react";
import { cn } from "@/lib/utils";

export type IconTextTone = "neutral" | "accent" | "like" | "repost";

export interface IconTextButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: React.ReactNode;
  count?: number;
  label: string;
  active?: boolean;
  tone?: IconTextTone;
  formatCount?: boolean;
}

const toneHover: Record<IconTextTone, string> = {
  neutral: "hover:text-accent",
  accent:  "hover:text-accent",
  like:    "hover:text-like",
  repost:  "hover:text-repost",
};

const toneActive: Record<IconTextTone, string> = {
  neutral: "text-accent",
  accent:  "text-accent",
  like:    "text-like",
  repost:  "text-repost",
};

export const IconTextButton = React.forwardRef<HTMLButtonElement, IconTextButtonProps>(
  function IconTextButton(
    {
      icon,
      count,
      label,
      active = false,
      tone = "neutral",
      formatCount: shouldFormat,
      className,
      type = "button",
      ...props
    },
    ref,
  ) {
    const formatCountFn = (n: number) => {
      if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
      if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
      return String(n);
    };

    const display =
      count === undefined
        ? null
        : shouldFormat !== false
        ? formatCountFn(count)
        : String(count);

    return (
      <button
        ref={ref}
        type={type}
        aria-label={label}
        title={label}
        className={cn(
          "group/itb inline-flex items-center gap-1.5 rounded-lg py-1.5 px-2 -m-2 transition-colors duration-150",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          active ? toneActive[tone] : cn("text-text-secondary", toneHover[tone]),
          className,
        )}
        {...props}
      >
        <span className="w-[18px] h-[18px] inline-flex items-center justify-center transition-transform duration-150 group-hover/itb:scale-110">
          {icon}
        </span>
        {display !== null && (
          <span className="text-[13px] font-medium tabular-nums leading-none">
            {display}
          </span>
        )}
      </button>
    );
  },
);
