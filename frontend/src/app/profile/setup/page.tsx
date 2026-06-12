"use client";

import React, { useState, useRef } from "react";
import { User, Camera, Loader2, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { apiClient } from "@/lib/api-client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/ui/card";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "sonner";

const FACULTY_OPTIONS = [
  { value: "", label: "Select your faculty..." },
  { value: "Engineering", label: "Faculty of Engineering" },
  { value: "Computer Applications", label: "Faculty of Computer Applications" },
  { value: "Management", label: "Faculty of Management / Business" },
  { value: "Law", label: "Faculty of Law" },
  { value: "Pharmacy", label: "Faculty of Pharmacy" },
  { value: "Hospitality", label: "Faculty of Hospitality" },
  { value: "Media & Communication", label: "Faculty of Media & Communication" },
  { value: "Agriculture", label: "Faculty of Agriculture" },
];

const YEAR_OPTIONS = [
  { value: "", label: "Select your year..." },
  { value: "1", label: "1st Year (Freshman)" },
  { value: "2", label: "2nd Year" },
  { value: "3", label: "3rd Year" },
  { value: "4", label: "4th Year" },
  { value: "5", label: "5th Year (Masters)" },
  { value: "6", label: "6th Year / Ph.D." },
  { value: "7", label: "Postdoctoral / Staff" },
];

const SOCIAL_PLATFORMS = [
  { key: "github", label: "GitHub", placeholder: "https://github.com/username" },
  { key: "linkedin", label: "LinkedIn", placeholder: "https://linkedin.com/in/username" },
  { key: "twitter", label: "Twitter", placeholder: "https://twitter.com/username" },
];

export default function ProfileSetupPage() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();

  const [displayName, setDisplayName] = useState(user?.profile?.display_name || "");
  const [faculty, setFaculty] = useState(user?.profile?.faculty || "");
  const [yearOfStudy, setYearOfStudy] = useState(String(user?.profile?.year_of_study ?? ""));
  const [bio, setBio] = useState(user?.profile?.bio || "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.profile?.avatar_url || null);
  const [coverUrl, setCoverUrl] = useState<string | null>(user?.profile?.cover_url || null);
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>(
    user?.profile?.social_links || {}
  );

  const [isLoading, setIsLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

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
      setAvatarUrl(res.data.url);
      toast.success("Avatar uploaded");
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
      setCoverUrl(res.data.url);
      toast.success("Cover photo uploaded");
    } catch {
      toast.error("Failed to upload cover photo");
    } finally {
      setUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  };

  const handleSocialLinkChange = (key: string, value: string) => {
    setSocialLinks((prev) => {
      const next = { ...prev };
      if (value) {
        next[key] = value;
      } else {
        delete next[key];
      }
      return next;
    });
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!displayName.trim()) newErrors.displayName = "Display name is required.";
    if (!faculty) newErrors.faculty = "Faculty is required.";
    if (!yearOfStudy) newErrors.yearOfStudy = "Year of study is required.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    setErrors({});

    try {
      await apiClient.patch("/users/me/profile", {
        display_name: displayName.trim(),
        faculty,
        year_of_study: parseInt(yearOfStudy),
        bio: bio.trim() || null,
        avatar_url: avatarUrl,
        cover_url: coverUrl,
        social_links: Object.keys(socialLinks).length > 0 ? socialLinks : null,
      });
      await refreshUser();
      router.push("/");
    } catch (err) {
      setErrors({ form: getApiErrorMessage(err, "Failed to update profile. Please try again.") });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center px-4 py-12 bg-bg">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-accent mb-6 shadow-lg shadow-accent/20">
            <User className="h-7 w-7 text-text-inverse" strokeWidth={2.5} />
          </div>
          <h1 className="text-3xl font-bold text-text-primary">
            {user?.profile?.display_name ? "Edit your profile" : "Set up your profile"}
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            {user?.profile?.display_name
              ? "Update your details, photos, and links"
              : "Tell us about yourself to connect with your campus"}
          </p>
        </div>

        {errors.form && (
          <div className="mb-6 p-4 rounded-xl bg-error/10 border border-error/20 text-sm font-semibold text-error text-center">
            {errors.form}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Cover photo */}
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="relative h-32 bg-gradient-to-br from-accent/30 via-accent/15 to-bg-elevated">
              {coverUrl && (
                <img src={coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
              )}
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                disabled={uploadingCover}
                className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/40 backdrop-blur-sm text-white text-[11px] font-semibold hover:bg-black/60 transition-colors"
              >
                {uploadingCover ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Camera className="h-3.5 w-3.5" />
                )}
                Cover photo
              </button>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                onChange={handleCoverUpload}
                className="hidden"
              />
            </div>

            {/* Avatar */}
            <div className="px-6 -mt-10 pb-6">
              <div className="relative inline-block">
                <Avatar
                  user={{ name: displayName, profile: { avatar_url: avatarUrl } }}
                  size={80}
                />
                <button
                  type="button"
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
              </div>
            </div>
          </div>

          {/* Basic fields */}
          <Input
            label="Display name"
            id="displayName"
            type="text"
            autoComplete="name"
            placeholder="e.g. Arjun"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            error={errors.displayName}
            required
          />

          <div className="flex flex-col gap-2">
            <label htmlFor="faculty" className="text-sm font-semibold text-text-primary">
              Faculty
            </label>
            <select
              id="faculty"
              value={faculty}
              onChange={(e) => setFaculty(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-bg-surface border border-border focus:border-accent focus:ring-4 focus:ring-accent/20 text-text-primary font-medium text-sm transition-all duration-200 outline-none"
              required
            >
              {FACULTY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {errors.faculty && <p className="text-xs text-error font-semibold">{errors.faculty}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="yearOfStudy" className="text-sm font-semibold text-text-primary">
              Year of study
            </label>
            <select
              id="yearOfStudy"
              value={yearOfStudy}
              onChange={(e) => setYearOfStudy(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-bg-surface border border-border focus:border-accent focus:ring-4 focus:ring-accent/20 text-text-primary font-medium text-sm transition-all duration-200 outline-none"
              required
            >
              {YEAR_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {errors.yearOfStudy && <p className="text-xs text-error font-semibold">{errors.yearOfStudy}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <label htmlFor="bio" className="text-sm font-semibold text-text-primary">
                Student Bio (Optional)
              </label>
              <span className="text-xs text-text-secondary font-semibold">
                {bio.length} / 500
              </span>
            </div>
            <textarea
              id="bio"
              maxLength={500}
              placeholder="Share something about yourself, your course, or your interests..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full min-h-[120px] p-4 rounded-xl bg-bg-surface border border-border focus:border-accent focus:ring-4 focus:ring-accent/20 text-text-primary font-medium text-sm placeholder-text-muted transition-all duration-200 outline-none resize-none"
            />
          </div>

          {/* Social links */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-text-primary">Social Links (Optional)</label>
            {SOCIAL_PLATFORMS.map(({ key, label, placeholder }) => (
              <div key={key}>
                <label htmlFor={`social-${key}`} className="text-xs font-semibold text-text-secondary mb-1 block">
                  {label}
                </label>
                <input
                  id={`social-${key}`}
                  type="url"
                  placeholder={placeholder}
                  value={socialLinks[key] || ""}
                  onChange={(e) => handleSocialLinkChange(key, e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-bg-surface border border-border focus:border-accent focus:ring-2 focus:ring-accent/20 text-text-primary text-sm transition-all outline-none"
                />
              </div>
            ))}
          </div>

          <Button type="submit" isLoading={isLoading} fullWidth className="mt-2">
            {user?.profile?.display_name ? "Save changes" : "Complete setup"}
          </Button>
        </form>
      </div>
    </div>
  );
}
