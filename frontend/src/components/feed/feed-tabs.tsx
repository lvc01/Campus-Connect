"use client";

import React from "react";
import { TabsBar } from "@/components/ui/tabs-bar";

export interface FeedTabsProps {
  active: "foryou" | "faculty";
  onChange: (next: "foryou" | "faculty") => void;
  facultyLabel?: string | null;
}

/**
 * The For You / Faculty toggle that lives at the top of the home feed.
 * Wraps the new TabsBar primitive to keep the page-level data and the
 * visual chrome decoupled.
 */
export const FeedTabs: React.FC<FeedTabsProps> = ({ active, onChange, facultyLabel }) => {
  return (
    <TabsBar
      items={[
        { key: "foryou", label: "For You" },
        { key: "faculty", label: facultyLabel || "Faculty" },
      ]}
      active={active}
      onChange={(k) => onChange(k as "foryou" | "faculty")}
      sticky
    />
  );
};
