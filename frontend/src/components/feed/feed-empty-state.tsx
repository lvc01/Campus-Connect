"use client";

import React from "react";
import { MessageCircle } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

/** Shown when the feed loads successfully but has no posts. */
export const FeedEmptyState: React.FC = () => (
  <EmptyState
    icon={<MessageCircle className="h-6 w-6" />}
    title="No posts yet"
    description="Be the first to share what's happening on campus."
  />
);
