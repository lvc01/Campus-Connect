"use client";

import React from "react";
import Link from "next/link";
import { Bookmark, ImageOff, Images, MapPin } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { getInitials, getRelativeTime } from "@/lib/utils";
import type { ListingData } from "@/types/marketplace";

const CATEGORY_LABELS: Record<string, string> = {
  textbook: "Textbook", accommodation: "Accommodation", tutoring: "Tutoring",
  electronics: "Electronics", clothing: "Clothing", furniture: "Furniture",
  sports: "Sports", food: "Food", transport: "Transport", services: "Services",
  other: "Other",
};

const CONDITION_LABELS: Record<string, string> = {
  new: "New", like_new: "Like New", good: "Good", fair: "Fair", poor: "Poor",
};

interface ListingCardProps {
  listing: ListingData;
  onSaveToggle: (id: string, newSaved: boolean) => void;
}

export const ListingCard: React.FC<ListingCardProps> = ({ listing, onSaveToggle }) => {
  const [isSaving, setIsSaving] = React.useState(false);

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isSaving) return;
    setIsSaving(true);
    try {
      if (listing.is_saved) {
        await apiClient.delete(`/marketplace/listings/${listing.id}/save`);
      } else {
        await apiClient.post(`/marketplace/listings/${listing.id}/save`);
      }
      onSaveToggle(listing.id, !listing.is_saved);
    } catch (err) {
      console.error("Failed to toggle save", err);
    } finally {
      setIsSaving(false);
    }
  };

  const coverImage = listing.images?.[0]?.url;
  const sellerName = listing.seller?.profile?.display_name || listing.seller?.email?.split("@")[0] || "Unknown";
  const stars = listing.avg_rating > 0
    ? "★".repeat(Math.round(listing.avg_rating)) + "☆".repeat(5 - Math.round(listing.avg_rating))
    : "";

  return (
    <Link href={`/marketplace/${listing.id}`} className="block bg-bg-surface border border-border rounded-xl overflow-hidden flex flex-col hover:scale-[1.02] transition-all duration-200 group">
      <div className="relative h-44 bg-bg-surface overflow-hidden">
        {coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverImage} alt={listing.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageOff className="h-12 w-12 text-text-muted" strokeWidth={1} />
          </div>
        )}

        <button
          onClick={handleSave}
          aria-label={listing.is_saved ? "Unsave listing" : "Save listing"}
          className={`absolute top-3 right-3 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 backdrop-blur-sm ${
            listing.is_saved
              ? "bg-like/20 text-like"
              : "bg-bg-surface/40 text-text-secondary hover:bg-bg-surface/60 hover:text-text-primary"
          }`}
        >
          <Bookmark
            className="h-4 w-4"
            fill={listing.is_saved ? "currentColor" : "none"}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </button>

        <span className="absolute bottom-3 left-3 text-[10px] font-bold px-2 py-1 rounded-full bg-black/60 backdrop-blur-sm text-text-primary border border-white/10">
          {CATEGORY_LABELS[listing.category] || listing.category}
        </span>

        {listing.images && listing.images.length > 1 && (
          <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-black/60 backdrop-blur-sm text-white border border-white/10">
            <Images className="h-3 w-3" />
            {listing.images.length}
          </span>
        )}
      </div>

      <div className="p-5 flex flex-col gap-3 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-bold text-text-primary leading-tight line-clamp-2">{listing.title}</h3>
          <span className="text-base font-black text-success shrink-0">₹{listing.price.toLocaleString("en-IN")}</span>
        </div>

        {listing.condition && (
          <span className="text-[10px] font-semibold text-text-muted self-start px-2 py-0.5 rounded-full bg-bg-surface/50 border border-border/50">
            {CONDITION_LABELS[listing.condition] || listing.condition}
          </span>
        )}

        {listing.description && (
          <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">{listing.description}</p>
        )}

        {listing.location && (
          <div className="flex items-center gap-1 text-[11px] text-text-muted">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{listing.location}</span>
          </div>
        )}

        {stars && (
          <div className="flex items-center gap-1.5">
            <span className="text-amber-400 text-xs tracking-wider">{stars}</span>
            <span className="text-[10px] text-text-muted">({listing.rating_count})</span>
          </div>
        )}

        <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/50">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-accent flex items-center justify-center shadow-sm">
              <span className="text-[10px] font-bold text-text-inverse select-none">{getInitials(sellerName)}</span>
            </div>
            <span className="text-[11px] font-semibold text-text-secondary truncate max-w-[100px]">{sellerName}</span>
          </div>
          <span className="text-[10px] text-text-muted font-medium">{getRelativeTime(listing.created_at)}</span>
        </div>
      </div>
    </Link>
  );
};
