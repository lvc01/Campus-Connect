"use client";

import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export interface FeedSkeletonListProps {
  count?: number;
  className?: string;
}

function PostCardSkeleton() {
  return (
    <div className="border-b border-border px-6 py-4">
      <div className="flex gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
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
      <PostCardSkeleton key={i} />
    ))}
  </div>
);
