import { Skeleton } from "@/components/ui/skeleton";

/**
 * Generic detail-page loading skeleton: an author/title row, a media block,
 * and a few text lines. Replaces bare centered spinners so detail pages
 * (post, event, listing) load with a content-shaped placeholder.
 */
export function DetailSkeleton({ media = true }: { media?: boolean }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <Skeleton className="mb-6 h-4 w-16" />
      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-11 w-11 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-5/6" />
          <Skeleton className="h-3.5 w-2/3" />
        </div>
        {media && <Skeleton className="mt-4 h-56 w-full rounded-xl" />}
        <div className="mt-4 flex gap-4">
          <Skeleton className="h-8 w-16 rounded-full" />
          <Skeleton className="h-8 w-16 rounded-full" />
          <Skeleton className="h-8 w-16 rounded-full" />
        </div>
      </div>
    </div>
  );
}
