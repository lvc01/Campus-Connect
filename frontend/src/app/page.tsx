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
      <PageHeader title="Home" />
      <FeedTabs value={tab} onChange={setTab} />
      <ComposeBox />
      <Feed tab={tab} />
    </LayoutShell>
  );
}
