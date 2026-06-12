"use client";

import React from "react";
import { TabsBar } from "@/components/ui/tabs-bar";

export type ProfileTab = "posts" | "replies" | "media" | "reposts" | "likes";

export interface ProfileTabsProps {
  active: ProfileTab;
  onChange: (next: ProfileTab) => void;
}

export const ProfileTabs: React.FC<ProfileTabsProps> = ({ active, onChange }) => (
  <TabsBar
    items={[
      { key: "posts", label: "Posts" },
      { key: "replies", label: "Replies" },
      { key: "media", label: "Media" },
      { key: "reposts", label: "Reposts" },
      { key: "likes", label: "Likes" },
    ]}
    active={active}
    onChange={(k) => onChange(k as ProfileTab)}
    sticky
  />
);
