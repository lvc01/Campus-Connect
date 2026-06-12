"use client";

import React from "react";
import { cn } from "@/lib/utils";

export type IconButtonVariant = "ghost" | "subtle" | "outline" | "primary" | "danger";
export type IconButtonSize = "sm" | "md" | "lg";

const sizeMap: Record<IconButtonSize, { box: string; icon: string }> = {
  sm: { box: "w-8 h-8",            icon: "w-4 h-4" },
  md: { box: "w-9 h-9",            icon: "w-[18px] h-[18px]" },
  lg: { box: "w-11 h-11",          icon: "w-5 h-5" },
};

export interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: React.ReactNode;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  label: string;
  rounded?: "full" | "card";
  active?: boolean;
  activeColorClass?: string;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    icon,
    variant = "ghost",
    size = "md",
    label,
    rounded = "full",
    active = false,
    activeColorClass,
    className,
    type = "button",
    ...props
  },
  ref,
) {
  const s = sizeMap[size];

  const variants: Record<IconButtonVariant, string> = {
    ghost:
      "text-text-secondary hover:bg-text-primary/10 hover:text-text-primary focus-visible:bg-text-primary/10",
    subtle:
      "bg-bg-elevated text-text-primary hover:bg-border focus-visible:bg-border",
    outline:
      "border border-border text-text-primary hover:bg-bg-elevated focus-visible:bg-bg-elevated",
    primary:
      "bg-accent text-text-inverse hover:bg-accent-hover focus-visible:bg-accent-hover",
    danger:
      "bg-error text-text-inverse hover:brightness-110 focus-visible:brightness-110",
  };

  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex items-center justify-center transition-colors duration-150 select-none",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        rounded === "full" ? "rounded-full" : "rounded-2xl",
        s.box,
        active && activeColorClass ? activeColorClass : variants[variant],
        className,
      )}
      {...props}
    >
      <span className={cn("inline-flex items-center justify-center", s.icon)}>
        {icon}
      </span>
    </button>
  );
});
