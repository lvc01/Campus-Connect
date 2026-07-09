"use client";

import { useState } from "react";
import { LayoutShell } from "@/components/layout/LayoutShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { FeedTabs } from "@/components/feed/FeedTabs";
import { ComposeBox } from "@/components/feed/ComposeBox";
import { Feed } from "@/components/feed/Feed";

export default function HomePage() {
  const [tab, setTab] = useState<"foryou" | "faculty">("foryou");
  return (
    <LayoutShell>
      <div className="reveal-up stagger-1">
        <PageHeader title="Home" />
      </div>
      <div className="reveal-up stagger-2">
        <FeedTabs value={tab} onChange={setTab} />
      </div>
      <div className="reveal-up stagger-3">
        <ComposeBox />
      </div>
      <div className="reveal-up stagger-4">
        <Feed tab={tab} />
      </div>
    </LayoutShell>
  );
}
