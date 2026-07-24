"use client";

import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export interface FeedSkeletonListProps {
  count?: number;
  className?: string;
}

function PostCardSkeleton() {
  return (
    <div className="border-b border-border-quiet px-4 sm:px-6 py-4">
      <div className="flex gap-3">
        <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-4 w-full mt-3" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-3/4" />
          <div className="flex gap-4 pt-3">
            <Skeleton className="h-7 w-14 rounded-full" />
            <Skeleton className="h-7 w-14 rounded-full" />
            <Skeleton className="h-7 w-14 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export const FeedSkeletonList: React.FC<FeedSkeletonListProps> = ({
  count = 3,
  className,
}) => (
  <div className={className}>
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className="reveal-up"
        style={{ animationDelay: `${Math.min(i * 60, 360)}ms` }}
      >
        <PostCardSkeleton />
      </div>
    ))}
  </div>
);
