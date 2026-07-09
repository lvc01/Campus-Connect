"use client";

import { AlertCircle } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * Generic error state with an optional retry action. Built on EmptyState so
 * loading/empty/error all share one visual language across the app.
 */
export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <EmptyState
      icon={<AlertCircle className="h-6 w-6" />}
      title={title}
      description={message}
      action={
        onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-full bg-accent px-5 py-2 text-sm font-bold text-accent-foreground transition hover:opacity-90 active:scale-95"
          >
            Try again
          </button>
        ) : undefined
      }
    />
  );
}
