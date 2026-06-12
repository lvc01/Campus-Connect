"use client";

import React, { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/context/auth-context";
import { apiClient } from "@/lib/api-client";
import type { PostData } from "@/types/post";

interface CreatePostProps {
  onPostCreated?: (newPost: PostData) => void;
  onPostUpdated?: (updatedPost: PostData) => void;
  clubId?: string;
  editPost?: PostData | null;
  onCloseEdit?: () => void;
}

export function CreatePost({
  onPostCreated,
  onPostUpdated,
  clubId,
  editPost,
  onCloseEdit,
}: CreatePostProps) {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [uploadedFile, setUploadedFile] = useState<{ url: string; media_type: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEditing = !!editPost;

  useEffect(() => {
    if (editPost) {
      const task = window.setTimeout(() => {
        setContent(editPost.content || "");
        const m = editPost.media?.[0];
        if (m) {
          setMediaUrl(m.url);
          setUploadedFile({ url: m.url, media_type: m.media_type });
        }
      }, 0);
      return () => window.clearTimeout(task);
    }
  }, [editPost]);

  const resetForm = () => {
    setContent("");
    setMediaUrl("");
    setUploadedFile(null);
    setError("");
  };

  const handleClose = () => {
    resetForm();
    if (onCloseEdit) onCloseEdit();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await apiClient.post("/posts/upload", formData);
      const data = response.data;
      setUploadedFile({ url: data.url, media_type: data.type });
      setMediaUrl(data.url);
    } catch (err: unknown) {
      const detail = typeof err === "object" && err && "response" in err
        ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
        : undefined;
      setError(detail || "Failed to upload file.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !mediaUrl.trim()) return;

    setIsLoading(true);
    setError("");

    try {
      const payload: {
        content: string;
        visibility: string;
        club_id?: string;
        media_urls?: string[];
        post_type?: string;
      } = { content: content.trim(), visibility: "public" };
      if (clubId && !isEditing) payload.club_id = clubId;
      if (mediaUrl.trim()) payload.media_urls = [mediaUrl.trim()];
      if (uploadedFile?.media_type) payload.post_type = uploadedFile.media_type;

      if (isEditing && editPost) {
        const response = await apiClient.patch(`/posts/${editPost.id}`, {
          content: content.trim(),
          visibility: "public",
        });
        if (onPostUpdated) onPostUpdated(response.data as PostData);
      } else {
        const response = await apiClient.post("/posts", payload);
        if (onPostCreated) onPostCreated(response.data as PostData);
      }
      resetForm();
      if (onCloseEdit) onCloseEdit();
    } catch (err: unknown) {
      const detail = typeof err === "object" && err && "response" in err
        ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
        : undefined;
      setError(detail || "Failed to save post.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  };

  const authorName = user?.profile?.display_name || user?.email?.split("@")[0] || "Student";
  const charCount = content.length;
  const charLimit = 500;
  const nearLimit = charCount > charLimit * 0.8;

  return (
    <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-border bg-bg">
      {error && (
        <div className="mb-3.5 px-4 py-3 rounded-xl bg-like/10 border border-like/20 text-[13px] font-semibold text-like text-center">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="flex gap-3 sm:gap-4">
          <div className="shrink-0 mt-1">
            <Avatar user={{ name: authorName, profile: { avatar_url: user?.profile?.avatar_url } }} size={40} />
          </div>

          <div className="flex-1 min-w-0">
            <textarea
              ref={textareaRef}
              id="composer-input"
              placeholder="What is happening on campus?"
              value={content}
              onChange={handleTextareaChange}
              rows={3}
              className="w-full bg-transparent text-text-primary text-[17px] placeholder-text-secondary outline-none resize-none border-none leading-normal"
              style={{ minHeight: "52px" }}
            />

            {/* Media preview */}
            {uploadedFile && (
              <div className="mt-3.5 rounded-2xl overflow-hidden border border-border max-h-[300px] relative group">
                {uploadedFile.media_type === "video" ? (
                  <video src={uploadedFile.url} controls className="w-full h-auto max-h-[280px] object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={uploadedFile.url} alt="" className="w-full h-auto max-h-[280px] object-cover" />
                )}
                <button
                  type="button"
                  onClick={() => { setUploadedFile(null); setMediaUrl(""); }}
                  className="absolute top-2.5 right-2.5 w-8 h-8 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-white transition-colors"
                  aria-label="Remove media"
                >
                  <X size={16} strokeWidth={2.5} />
                </button>
              </div>
            )}

            {/* Divider */}
            <div className="mt-4 pt-4 border-t border-border flex items-center justify-between flex-wrap gap-2">
              {/* Tool buttons */}
              <div className="flex items-center gap-2 text-accent font-bold select-none text-[15px]">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="cursor-pointer text-xs font-bold text-accent bg-accent/5 hover:bg-accent/15 px-3.5 py-1.5 rounded-full transition-all duration-150 select-none disabled:opacity-50 shrink-0 inline-flex items-center justify-center"
                  title="Add media"
                >
                  {isUploading ? "uploading..." : "media"}
                </button>
              </div>

              {/* Right: char counter + buttons */}
              <div className="flex items-center gap-3.5 shrink-0">
                {content.length > 0 && (
                  <span className={`text-sm font-medium ${nearLimit ? "text-like" : "text-text-secondary"}`}>
                    {charLimit - charCount}
                  </span>
                )}

                {isEditing && (
                  <button
                    type="button"
                    onClick={handleClose}
                    className="text-sm text-text-secondary hover:text-text-primary font-medium px-4 py-2 rounded-full hover:bg-bg-elevated transition-colors"
                  >
                    Cancel
                  </button>
                )}

                <button
                  type="submit"
                  disabled={(!content.trim() && !mediaUrl.trim()) || isLoading || isUploading}
                  className="h-10 px-6 bg-accent hover:bg-accent-hover disabled:opacity-50 text-text-inverse font-bold text-[15px] rounded-full transition-all active:scale-[0.97]"
                >
                  {isLoading ? "Posting..." : isEditing ? "Save" : "Post"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
