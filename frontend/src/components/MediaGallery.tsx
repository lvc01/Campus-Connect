"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MediaAttachment } from "@/types/post";

/**
 * Post media gallery for the web feed/detail surfaces.
 *
 * Mirrors `mobile/components/MediaGallery.tsx`: a single image fills the frame,
 * multiple images become a horizontal scroll-snap carousel with page dots, and
 * tapping an image opens a full-screen lightbox. Videos render with native
 * controls inline (web can play video directly, unlike the mobile poster badge).
 */
export function MediaGallery({ media }: { media: MediaAttachment[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  if (!media || media.length === 0) return null;

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    if (idx !== activeIndex) setActiveIndex(idx);
  };

  const single = media.length === 1;

  return (
    <>
      <div className="mt-3 overflow-hidden rounded-xl border border-border">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className={cn(
            "flex snap-x snap-mandatory overflow-x-auto no-scrollbar",
            single && "overflow-x-hidden",
          )}
        >
          {media.map((item, index) => (
            <div key={item.id ?? index} className="relative w-full shrink-0 snap-center">
              {item.media_type === "video" ? (
                <video
                  src={item.url}
                  controls
                  className="max-h-[480px] w-full bg-black/5 object-contain"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setLightbox(index)}
                  className="block w-full"
                  aria-label="Open image"
                >
                  <img
                    src={item.url}
                    alt=""
                    loading="lazy"
                    className="max-h-[480px] w-full cursor-zoom-in bg-black/5 object-cover"
                  />
                </button>
              )}
            </div>
          ))}
        </div>

        {media.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 py-2">
            {media.map((_, index) => (
              <span
                key={index}
                className={cn(
                  "h-1.5 w-1.5 rounded-full transition-colors",
                  index === activeIndex ? "bg-accent" : "bg-border",
                )}
              />
            ))}
          </div>
        )}
      </div>

      {lightbox !== null && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 animate-fade-in"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            className="absolute right-5 top-5 rounded-full p-2 text-white/90 hover:bg-white/10"
            onClick={() => setLightbox(null)}
            aria-label="Close"
          >
            <X className="h-6 w-6" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={media[lightbox].url}
            alt=""
            className="max-h-[90vh] max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
