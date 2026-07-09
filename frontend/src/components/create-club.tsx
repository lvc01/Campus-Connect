"use client";

import React, { useState } from "react";
import { Info, X } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getApiErrorMessage } from "@/lib/api-error";

interface CreateClubPayload {
  name: string;
  description: string | null;
  category: string;
  logo_url: string | null;
  banner_url: string | null;
}

interface CreateClubProps {
  isOpen: boolean;
  onClose: () => void;
  onClubCreated: (club: CreateClubPayload & { id: string }) => void;
}

const CATEGORY_OPTIONS = [
  { value: "academic", label: "Academic & Professional" },
  { value: "sports", label: "Sports & Recreation" },
  { value: "cultural", label: "Arts & Culture" },
  { value: "social", label: "Social & Networking" },
  { value: "political", label: "Political & Activism" },
  { value: "religious", label: "Faith & Spiritual" },
  { value: "tech", label: "Technology & Engineering" },
  { value: "other", label: "Other Interests" },
];

export const CreateClub: React.FC<CreateClubProps> = ({
  isOpen,
  onClose,
  onClubCreated,
}) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("other");
  const [logoUrl, setLogoUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsLoading(true);
    setError("");

    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        category,
        logo_url: logoUrl.trim() || null,
        banner_url: bannerUrl.trim() || null,
      };

      const response = await apiClient.post<CreateClubPayload & { id: string }>("/clubs", payload);
      onClubCreated(response.data);

      setName("");
      setDescription("");
      setCategory("other");
      setLogoUrl("");
      setBannerUrl("");
      onClose();
    } catch (err) {
      setError(
        getApiErrorMessage(err, "Failed to submit society request. Please try again.")
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-lg bg-surface border border-border rounded-3xl p-6 sm:p-8 animate-pop-in relative shadow-2xl overflow-y-auto max-h-[90vh]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-6 top-6 p-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-[rgba(var(--bg-hover),0.08)] focus:outline-none transition-colors"
          aria-label="Close modal"
        >
          <X className="h-[18px] w-[18px]" strokeWidth={2.5} />
        </button>

        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-tight text-text-primary">Register a Society</h2>
          <p className="text-text-secondary text-xs mt-1.5 font-medium">
            Start a verified campus community. Registered clubs require official moderator approval.
          </p>
        </div>

        <div className="mb-6 p-3.5 rounded-xl bg-accent/10 border border-accent/20 text-xs font-medium text-accent flex items-start gap-2.5">
          <Info className="w-4 h-4 text-accent shrink-0 mt-0.5" strokeWidth={2.5} />
          <div>
            All requests initialize as pending and are reviewable by campus moderators. Once approved, the society will appear publicly in the directory.
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-like/10 border border-like/20 text-xs font-semibold text-like text-center animate-fade-in">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            label="Society Name"
            id="club-name"
            placeholder="e.g. UCT Developer Society"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={150}
          />

          <div className="flex flex-col gap-2">
            <label htmlFor="club-category" className="text-sm font-semibold text-text-primary">
              Primary Category
            </label>
            <select
              id="club-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-surface border border-border focus:border-accent focus:ring-4 focus:ring-accent/20 text-text-primary font-medium text-sm transition-all duration-200 outline-none"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="club-description"
              className="text-sm font-semibold text-text-primary select-none cursor-pointer"
            >
              Description
            </label>
            <textarea
              id="club-description"
              placeholder="What is your society about? Highlight activities, mission statement, or meeting details..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full min-h-[100px] p-4 rounded-xl bg-surface border border-border focus:border-accent focus:ring-4 focus:ring-accent/20 text-text-primary font-medium text-sm placeholder:text-text-tertiary transition-all duration-200 outline-none resize-none"
              maxLength={2000}
            />
          </div>

          <Input
            label="Logo Image URL (Optional)"
            id="club-logo"
            placeholder="e.g. https://images.unsplash.com/photo-..."
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            type="url"
            maxLength={500}
          />

          <Input
            label="Banner Image URL (Optional)"
            id="club-banner"
            placeholder="e.g. https://images.unsplash.com/photo-..."
            value={bannerUrl}
            onChange={(e) => setBannerUrl(e.target.value)}
            type="url"
            maxLength={500}
          />

          <div className="flex gap-4 justify-end pt-3">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={isLoading}
              disabled={!name.trim()}
            >
              Submit Request
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
