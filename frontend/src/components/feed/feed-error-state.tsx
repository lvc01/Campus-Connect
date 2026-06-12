"use client";

import React from "react";
import { Bell } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export interface FeedErrorStateProps {
  message: string;
  onRetry: () => void;
}

/** Shown when the feed fetch fails. */
export const FeedErrorState: React.FC<FeedErrorStateProps> = ({ message, onRetry }) => (
  <EmptyState
    icon={<Bell className="h-6 w-6" />}
    title="Something went wrong"
    description={message}
    action={
      <button
        type="button"
        onClick={onRetry}
        className="rounded-full bg-accent px-5 py-2 text-sm font-bold text-text-inverse transition hover:bg-accent-hover active:scale-95"
      >
        Try again
      </button>
    }
  />
);
