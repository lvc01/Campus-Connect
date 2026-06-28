"use client";

import React, { useState, useRef } from "react";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getApiErrorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import { Plus, X, Upload, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ListingData } from "@/types/marketplace";

const CATEGORIES = [
  { value: "textbook", label: "Textbook" },
  { value: "accommodation", label: "Accommodation" },
  { value: "tutoring", label: "Tutoring" },
  { value: "electronics", label: "Electronics" },
  { value: "clothing", label: "Clothing" },
  { value: "furniture", label: "Furniture" },
  { value: "sports", label: "Sports" },
  { value: "food", label: "Food" },
  { value: "transport", label: "Transport" },
  { value: "services", label: "Services" },
  { value: "other", label: "Other" },
];

const CONDITIONS = [
  { value: "new", label: "New" },
  { value: "like_new", label: "Like New" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "poor", label: "Poor" },
];

interface CreateListingProps {
  isOpen: boolean;
  onClose: () => void;
  onListingCreated: (listing: any) => void;
  editListing?: ListingData;
}

export const CreateListing: React.FC<CreateListingProps> = ({
  isOpen,
  onClose,
  onListingCreated,
  editListing,
}) => {
  const isEdit = !!editListing;
  const [title, setTitle] = useState(editListing?.title || "");
  const [description, setDescription] = useState(editListing?.description || "");
  const [price, setPrice] = useState(editListing?.price?.toString() || "");
  const [category, setCategory] = useState(editListing?.category || "");
  const [condition, setCondition] = useState(editListing?.condition || "");
  const [location, setLocation] = useState(editListing?.location || "");
  const [imageUrls, setImageUrls] = useState<string[]>(
    editListing?.images?.map((img) => img.url) || []
  );
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await apiClient.post("/posts/upload", formData);
      setImageUrls((prev) => [...prev, res.data.url]);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to upload image."));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleAddUrl = () => {
    const url = imageUrlInput.trim();
    if (url && !imageUrls.includes(url)) {
      setImageUrls((prev) => [...prev, url]);
      setImageUrlInput("");
    }
  };

  const handleRemoveImage = (idx: number) => {
    setImageUrls((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      const payload: Record<string, any> = {
        title: title.trim(),
        description: description.trim() || null,
        price: parseFloat(price),
        category,
        condition: condition || null,
        location: location.trim() || null,
        image_urls: imageUrls,
      };

      let response;
      if (isEdit && editListing) {
        response = await apiClient.patch(
          `/marketplace/listings/${editListing.id}`,
          payload
        );
      } else {
        response = await apiClient.post("/marketplace/listings", payload);
      }
      onListingCreated(response.data);
      setTitle("");
      setDescription("");
      setPrice("");
      setCategory("");
      setCondition("");
      setLocation("");
      setImageUrls([]);
      setImageUrlInput("");
      onClose();
    } catch (err) {
      setError(
        getApiErrorMessage(
          err,
          isEdit ? "Failed to update listing." : "Failed to create listing."
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-lg bg-bg-surface border border-border bg-bg-main shadow-2xl rounded-3xl p-6 sm:p-8 animate-pop-in relative max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-6 top-6 text-text-muted hover:text-text-main transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-2xl font-bold tracking-tight text-text-main">
          {isEdit ? "Edit Listing" : "Create Listing"}
        </h2>
        <p className="text-text-muted text-xs mt-1.5 font-medium">
          {isEdit
            ? "Update your listing details"
            : "Sell textbooks, electronics, or offer services"}
        </p>

        {error && (
          <div className="mb-4 mt-4 p-3 rounded-xl bg-red-950/40 border border-red-500/20 text-xs text-red-300 font-semibold flex items-center gap-2">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 mt-6">
          <Input
            label="Title"
            id="listing-title"
            placeholder="e.g. Calculus Textbook 5th Ed"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <div className="flex flex-col gap-2">
            <label
              htmlFor="listing-description"
              className="text-sm font-semibold text-text-main"
            >
              Description
            </label>
            <textarea
              id="listing-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your item — condition, reason for selling, etc."
              className="w-full min-h-[100px] p-4 rounded-xl bg-bg-surface border border-border text-text-main font-medium text-sm placeholder:text-text-muted resize-none outline-none focus:border-accent/50 transition-all duration-200"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Price (₹)"
              id="listing-price"
              type="number"
              step="0.01"
              min="0"
              placeholder="250"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />

            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-text-main">
                Category
              </label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-text-main">
              Condition
            </label>
            <Select value={condition} onValueChange={setCondition}>
              <SelectTrigger>
                <SelectValue placeholder="Not specified (optional)" />
              </SelectTrigger>
              <SelectContent>
                {CONDITIONS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Input
            label="Location (optional)"
            id="listing-location"
            placeholder="e.g. North Campus, Block C"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-text-main">
              Images ({imageUrls.length})
            </label>

            <div className="flex gap-2">
              <input
                type="url"
                placeholder="Paste image URL..."
                value={imageUrlInput}
                onChange={(e) => setImageUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddUrl();
                  }
                }}
                className="flex-1 px-3 py-1.5 rounded-xl bg-bg-surface border border-border text-text-main text-sm font-medium placeholder:text-text-muted outline-none focus:border-accent/50 transition-all"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleAddUrl}
                disabled={!imageUrlInput.trim()}
              >
                Add
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="gap-1"
              >
                {isUploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                Upload
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {imageUrls.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mt-2">
                {imageUrls.map((url, idx) => (
                  <div
                    key={idx}
                    className="relative aspect-square rounded-lg overflow-hidden border border-border group"
                  >
                    <img
                      src={url}
                      alt={`Image ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(idx)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

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
              disabled={!title.trim() || !price || !category}
            >
              {isEdit ? "Save Changes" : "Post Listing"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
