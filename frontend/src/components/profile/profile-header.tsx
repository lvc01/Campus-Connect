"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import { Calendar, GraduationCap, Pencil, Camera, Loader2, Shield, ExternalLink, MessageCircle } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import type { PublicProfileData } from "@/types/user";

export interface ProfileHeaderProps {
  profile: PublicProfileData;
  isOwn: boolean;
  onProfileUpdated?: () => void;
}

const formatJoined = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
};

const formatFacultyYear = (faculty: string | null | undefined, year: number | null | undefined): string => {
  if (!faculty && !year) return "Student";
  const parts: string[] = [];
  if (faculty) parts.push(faculty);
  if (year) {
    const suffix =
      year === 1 ? "1st" : year === 2 ? "2nd" : year === 3 ? "3rd" : `${year}th`;
    parts.push(`${suffix} Year`);
  }
  return parts.join(" · ");
};

// Colors aligned with the shared RoleBadge semantic
// (admin=sky, moderator=violet, staff=amber).
const ROLE_BADGES: Record<string, { label: string; color: string }> = {
  admin: { label: "Admin", color: "bg-sky-500/10 text-sky-400 border-sky-500/20" },
  moderator: { label: "Moderator", color: "bg-violet-500/10 text-violet-400 border-violet-500/20" },
  university_staff: { label: "Staff", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
};

const SOCIAL_ICONS: Record<string, string> = {
  github: "GitHub",
  linkedin: "LinkedIn",
  twitter: "X",
  instagram: "Instagram",
  youtube: "YouTube",
  whatsapp: "WhatsApp",
};

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({ profile, isOwn, onProfileUpdated }) => {
  const p = profile.profile;
  const displayName = p?.display_name || "Student";
  const handle = profile.username || profile.email?.split("@")[0] || "user";
  const facultyYear = formatFacultyYear(p?.faculty, p?.year_of_study);
  const roleBadge = ROLE_BADGES[profile.role];

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await apiClient.post("/posts/upload", formData);
      await apiClient.patch("/users/me/profile", { avatar_url: res.data.url });
      toast.success("Avatar updated");
      onProfileUpdated?.();
    } catch {
      toast.error("Failed to upload avatar");
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await apiClient.post("/posts/upload", formData);
      await apiClient.patch("/users/me/profile", { cover_url: res.data.url });
      toast.success("Cover photo updated");
      onProfileUpdated?.();
    } catch {
      toast.error("Failed to upload cover photo");
    } finally {
      setUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  };

  const socialLinks = p?.social_links;

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      {/* Cover band */}
      <div className="relative h-32 sm:h-40 bg-gradient-to-br from-accent/30 via-accent/15 to-bg-elevated">
        {p?.cover_url && (
          <img src={p.cover_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )}
        {isOwn && (
          <>
            <button
              onClick={() => coverInputRef.current?.click()}
              disabled={uploadingCover}
              className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/40 backdrop-blur-sm text-white text-[11px] font-semibold hover:bg-black/60 transition-colors"
            >
              {uploadingCover ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Camera className="h-3.5 w-3.5" />
              )}
              Cover
            </button>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              onChange={handleCoverUpload}
              className="hidden"
            />
          </>
        )}
      </div>

      <div className="px-4 sm:px-6 pb-6">
        {/* Avatar + actions row */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 -mt-12 sm:-mt-16">
          <div className="relative shrink-0 ring-4 ring-bg rounded-full self-start">
            <Avatar
              user={{ name: displayName, profile: { avatar_url: p?.avatar_url } }}
              size={80}
            />
            {isOwn && (
              <>
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-accent flex items-center justify-center text-white shadow-lg hover:bg-accent/90 transition-colors"
                >
                  {uploadingAvatar ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Camera className="h-3.5 w-3.5" />
                  )}
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </>
            )}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {isOwn ? (
              <Link
                href="/profile/setup"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-text-primary border border-border rounded-full hover:bg-bg-elevated transition-colors"
              >
                <Pencil size={14} />
                Edit profile
              </Link>
            ) : (
              <Link
                href={`/messages?to=${profile.id}`}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-accent-foreground bg-accent rounded-full hover:opacity-90 transition-opacity"
              >
                <MessageCircle size={14} />
                Message
              </Link>
            )}
          </div>
        </div>

        {/* Name + handle + meta */}
        <div className="mt-4">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-black text-text-primary tracking-tight">
              {displayName}
            </h1>
            {roleBadge && (
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${roleBadge.color}`}>
                <Shield className="h-3 w-3" />
                {roleBadge.label}
              </span>
            )}
          </div>
          <p className="text-sm text-text-secondary mt-0.5">@{handle}</p>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-text-secondary">
            <span className="inline-flex items-center gap-1.5">
              <GraduationCap size={14} />
              {facultyYear}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Calendar size={14} />
              Joined {formatJoined(profile.created_at)}
            </span>
          </div>

          {p?.bio && (
            <p className="mt-3 text-[15px] text-text-primary leading-relaxed max-w-2xl">
              {p.bio}
            </p>
          )}

          {socialLinks && Object.keys(socialLinks).length > 0 && (
            <div className="mt-3 flex items-center gap-3 flex-wrap">
              {Object.entries(socialLinks).map(([platform, url]) => {
                if (!url) return null;
                let href: string;
                if (platform === "whatsapp") {
                  const digits = url.replace(/[^0-9]/g, "");
                  href = `https://wa.me/${digits}`;
                } else {
                  href = url.startsWith("http") ? url : `https://${url}`;
                }
                return (
                  <a
                    key={platform}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent/80 transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {SOCIAL_ICONS[platform] || platform}
                  </a>
                );
              })}
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          <StatCard label="Posts" value={profile.posts_count} />
          <StatCard label="Clubs" value={profile.clubs_count} />
          <StatCard label="Events" value={profile.events_count} />
          <StatCard label="Listings" value={profile.listings_count} />
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="bg-bg-elevated border border-border rounded-xl p-3.5 text-center">
    <p className="text-xl font-black text-text-primary tabular-nums">{value}</p>
    <p className="text-[10px] font-bold tracking-widest text-text-secondary uppercase mt-0.5">
      {label}
    </p>
  </div>
);
