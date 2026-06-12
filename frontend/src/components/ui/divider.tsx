import React from "react";
import { cn } from "@/lib/utils";

type DividerProps = React.HTMLAttributes<HTMLDivElement>;

export const Divider: React.FC<DividerProps> = ({ className, ...props }) => (
  <div
    role="separator"
    aria-orientation="horizontal"
    className={cn("h-px w-full bg-border", className)}
    {...props}
  />
);

type VDividerProps = React.HTMLAttributes<HTMLDivElement>;

export const VDivider: React.FC<VDividerProps> = ({ className, ...props }) => (
  <div
    role="separator"
    aria-orientation="vertical"
    className={cn("w-px h-full bg-border", className)}
    {...props}
  />
);
