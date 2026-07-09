"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { FeedTabs } from "./feed-tabs";

export interface FeedHeaderProps {
  active: "foryou" | "faculty";
  onChange: (next: "foryou" | "faculty") => void;
  facultyLabel?: string | null;
  className?: string;
}

/**
 * The sticky header at the top of the home feed: page title on desktop,
 * followed by the For You / Faculty tabs. The tabs are themselves sticky
 * and the title scrolls out of view on small screens.
 */
export const FeedHeader: React.FC<FeedHeaderProps> = ({
  active,
  onChange,
  facultyLabel,
  className,
}) => {
  return (
    <div className={cn("sticky top-[53px] lg:top-0 z-30 bg-background/85 backdrop-blur-xl", className)}>
      <FeedTabs active={active} onChange={onChange} facultyLabel={facultyLabel} />
    </div>
  );
};
