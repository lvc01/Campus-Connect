"use client";

import React, { useState, useRef } from "react";
import { User, Camera, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { apiClient } from "@/lib/api-client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/Avatar";
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
  { key: "twitter", label: "X", placeholder: "https://x.com/username" },
  { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/username" },
  { key: "youtube", label: "YouTube", placeholder: "https://youtube.com/@username" },
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
    <div className="min-h-screen bg-background flex flex-col items-center px-4 py-12">
      <div className="w-full max-w-lg reveal-up stagger-1">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent text-accent-foreground mb-6 shadow-md shadow-accent/20 reveal-up stagger-2">
            <User className="h-7 w-7" strokeWidth={2} />
          </div>
          <h1 className="font-display text-h1 font-medium text-text-primary leading-tight reveal-up stagger-3">
            {user?.profile?.display_name ? "Edit your profile" : "Set up your profile"}
          </h1>
          <p className="mt-2 font-sans text-body-sm text-text-secondary leading-relaxed reveal-up stagger-4">
            {user?.profile?.display_name
              ? "Update your details, photos, and links"
              : "Tell us about yourself to connect with your campus"}
          </p>
        </div>

        {errors.form && (
          <div className="mb-6 -ml-2 border-l-2 border-error bg-error/8 px-4 py-3 rounded-r-md reveal-up stagger-5">
            <p className="font-sans text-body-sm font-medium text-error">{errors.form}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 reveal-up stagger-5">
          {/* Cover photo + Avatar */}
          <div className="overflow-hidden rounded-xl border border-border-strong bg-surface">
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
            <label htmlFor="faculty" className="font-sans text-body-sm font-semibold text-text-primary">
              Faculty
            </label>
            <select
              id="faculty"
              value={faculty}
              onChange={(e) => setFaculty(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-surface border border-border-strong focus:border-accent focus:ring-4 focus:ring-accent/20 text-text-primary font-medium text-sm transition-all duration-200 outline-none"
              required
            >
              {FACULTY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {errors.faculty && <p className="font-sans text-caption text-error font-medium">{errors.faculty}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="yearOfStudy" className="font-sans text-body-sm font-semibold text-text-primary">
              Year of study
            </label>
            <select
              id="yearOfStudy"
              value={yearOfStudy}
              onChange={(e) => setYearOfStudy(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-surface border border-border-strong focus:border-accent focus:ring-4 focus:ring-accent/20 text-text-primary font-medium text-sm transition-all duration-200 outline-none"
              required
            >
              {YEAR_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {errors.yearOfStudy && <p className="font-sans text-caption text-error font-medium">{errors.yearOfStudy}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <label htmlFor="bio" className="font-sans text-body-sm font-semibold text-text-primary">
                Student Bio <span className="font-normal text-text-tertiary">(Optional)</span>
              </label>
              <span className="font-sans text-caption text-text-tertiary font-medium tabular-nums">
                {bio.length} / 500
              </span>
            </div>
            <textarea
              id="bio"
              maxLength={500}
              placeholder="Share something about yourself, your course, or your interests..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full min-h-[120px] p-4 rounded-xl bg-surface border border-border-strong focus:border-accent focus:ring-4 focus:ring-accent/20 text-text-primary font-sans text-body-sm leading-relaxed placeholder:text-text-tertiary transition-all duration-200 outline-none resize-none"
            />
          </div>

          {/* Social links */}
          <div className="space-y-3">
            <p className="font-sans text-body-sm font-semibold text-text-primary">
              Social Links <span className="font-normal text-text-tertiary">(Optional)</span>
            </p>
            {SOCIAL_PLATFORMS.map(({ key, label, placeholder }) => (
              <div key={key}>
                <label htmlFor={`social-${key}`} className="font-sans text-caption font-medium text-text-secondary mb-1 block">
                  {label}
                </label>
                <input
                  id={`social-${key}`}
                  type="url"
                  placeholder={placeholder}
                  value={socialLinks[key] || ""}
                  onChange={(e) => handleSocialLinkChange(key, e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface border border-border-strong focus:border-accent focus:ring-2 focus:ring-accent/20 text-text-primary font-sans text-body-sm transition-all outline-none"
                />
              </div>
            ))}
            <div>
              <label htmlFor="social-whatsapp" className="font-sans text-caption font-medium text-text-secondary mb-1 block">
                WhatsApp
              </label>
              <div className="flex items-center">
                <span className="px-3 py-2 rounded-l-lg bg-surface border border-r-0 border-border-strong font-sans text-body-sm text-text-secondary font-medium">
                  +91
                </span>
                <input
                  id="social-whatsapp"
                  type="tel"
                  placeholder="9876543210"
                  value={socialLinks.whatsapp?.replace(/^\+91/, "") || ""}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, "");
                    handleSocialLinkChange("whatsapp", val ? `+91${val}` : "");
                  }}
                  className="flex-1 px-3 py-2 rounded-r-lg bg-surface border border-border-strong focus:border-accent focus:ring-2 focus:ring-accent/20 text-text-primary font-sans text-body-sm transition-all outline-none"
                />
              </div>
            </div>
          </div>

          <Button type="submit" isLoading={isLoading} fullWidth className="mt-2 py-3">
            {user?.profile?.display_name ? "Save changes" : "Complete setup"}
          </Button>
        </form>
      </div>
    </div>
  );
}
