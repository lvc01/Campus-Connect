"use client";

import React, { useEffect, useRef } from "react";
import { ArrowRight, Zap } from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface AdData {
  id: string;
  title: string;
  content: string | null;
  image_url: string | null;
  target_url: string | null;
  boosted_post_id: string | null;
}

interface AdCardProps {
  ad: AdData;
}

export function AdCard({ ad }: AdCardProps) {
  const impressionTracked = useRef(false);

  useEffect(() => {
    if (!impressionTracked.current) {
      apiClient.post(`/ads/${ad.id}/impression`).catch(() => {});
      impressionTracked.current = true;
    }
  }, [ad.id]);

  const handleClick = () => {
    apiClient.post(`/ads/${ad.id}/click`).catch(() => {});
    if (ad.target_url) {
      window.open(ad.target_url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="bg-bg-elevated border border-border rounded-xl overflow-hidden">
      {/* Promoted header */}
      <div className="flex items-center gap-1.5 px-4 pt-3 pb-1">
        <Zap size={12} className="text-accent" fill="currentColor" />
        <span className="text-[10px] font-bold tracking-widest text-accent uppercase">Promoted</span>
      </div>

      {/* Image */}
      {ad.image_url && (
        <div className="px-4 py-2">
          <div
            className="w-full h-32 rounded-lg bg-bg-elevated bg-cover bg-center cursor-pointer"
            style={{ backgroundImage: `url(${ad.image_url})` }}
            onClick={handleClick}
          />
        </div>
      )}

      {/* Content */}
      <div className="px-4 pb-4 pt-2">
        <h4
          className="text-sm font-bold text-text-primary cursor-pointer hover:text-accent transition-colors"
          onClick={handleClick}
        >
          {ad.title}
        </h4>
        {ad.content && (
          <p className="text-xs text-text-secondary mt-1 leading-relaxed line-clamp-2">{ad.content}</p>
        )}
        {ad.target_url && (
          <button
            type="button"
            onClick={handleClick}
            className="mt-3 text-xs font-bold text-accent hover:text-accent-hover transition-colors flex items-center gap-1 cursor-pointer"
          >
            Learn more
            <ArrowRight size={12} strokeWidth={2.5} />
          </button>
        )}
      </div>
    </div>
  );
}
