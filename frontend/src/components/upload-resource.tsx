"use client";

import React, { useState } from "react";
import { FileText, Upload, X } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getApiErrorMessage } from "@/lib/api-error";
import type { ResourceData } from "@/types/academics";

interface UploadResponse {
  url: string;
}

interface UploadResourceProps {
  isOpen: boolean;
  onClose: () => void;
  courseId: string;
  onResourceUploaded: (resource: ResourceData) => void;
}

export const UploadResource: React.FC<UploadResourceProps> = ({
  isOpen,
  onClose,
  courseId,
  onResourceUploaded,
}) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [resourceType, setResourceType] = useState("notes");
  const [fileUrl, setFileUrl] = useState("");
  const [fileSize, setFileSize] = useState<number>(0);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState("");
  const [, setSelectedFile] = useState<File | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    setUploadProgress(0);
    setFileName(file.name);
    setFileSize(file.size);
    setSelectedFile(file);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await apiClient.post<UploadResponse>("/posts/upload", formData, {
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(pct);
          }
        },
      });

      setFileUrl(response.data.url);
      setUploadProgress(100);
    } catch (err) {
      setError(getApiErrorMessage(err, "Upload failed. Please try again."));
      setFileName("");
      setSelectedFile(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      uploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      uploadFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !fileUrl) return;

    setIsLoading(true);
    setError("");

    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        resource_type: resourceType,
        file_url: fileUrl,
        file_size: fileSize || null,
      };

      const response = await apiClient.post<ResourceData>(`/academics/courses/${courseId}/resources`, payload);
      onResourceUploaded(response.data);

      setTitle("");
      setDescription("");
      setResourceType("notes");
      setFileUrl("");
      setFileSize(0);
      setFileName("");
      setUploadProgress(0);
      onClose();
    } catch (err) {
      setError(
        getApiErrorMessage(err, "Failed to upload study resource. Make sure you have joined this course.")
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-lg bg-bg-elevated border border-border shadow-2xl rounded-3xl p-6 sm:p-8 animate-pop-in relative overflow-y-auto max-h-[90vh]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-6 top-6 p-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-bg focus:outline-none transition-colors"
          aria-label="Close modal"
        >
          <X className="h-[18px] w-[18px]" strokeWidth={2.5} />
        </button>

        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-tight text-text-primary">Share Study Resource</h2>
          <p className="text-text-secondary text-xs mt-1.5 font-medium">
            Upload helpful notes, past exam papers, assignments, or study guides.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-like/10 border border-like/20 text-xs font-semibold text-like text-center animate-fade-in">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            label="Resource Title"
            id="resource-title"
            placeholder="e.g. 2025 CSC1015F June Exam Answers"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={300}
          />

          <div className="flex flex-col gap-2">
            <label
              htmlFor="resource-type"
              className="text-sm font-semibold text-text-primary"
            >
              Document Category
            </label>
            <select
              id="resource-type"
              value={resourceType}
              onChange={(e) => setResourceType(e.target.value)}
              className="w-full h-12 px-4 rounded-xl bg-bg-surface border border-border focus:border-accent focus:ring-4 focus:ring-accent/20 text-text-primary font-medium text-sm transition-all duration-200 outline-none cursor-pointer"
            >
              <option value="notes">Lecture &amp; Study Notes</option>
              <option value="past_paper">Past Exam Paper / Test</option>
              <option value="study_guide">Study Guide / Syllabus</option>
              <option value="other">Other Material</option>
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="resource-description"
              className="text-sm font-semibold text-text-primary"
            >
              Short Description (Optional)
            </label>
            <textarea
              id="resource-description"
              placeholder="e.g. Full answers with diagrams from the June exam session. Verified by course tutor."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full min-h-[90px] p-4 rounded-xl bg-bg-surface border border-border focus:border-accent focus:ring-4 focus:ring-accent/20 text-text-primary font-medium text-sm placeholder-text-muted transition-all duration-200 outline-none resize-none"
              maxLength={2000}
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-text-primary">File Attachment *</span>

            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`w-full border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-6 transition-all duration-200 ${
                dragActive
                  ? "border-accent bg-accent/10"
                  : fileUrl
                  ? "border-border bg-bg-elevated"
                  : "border-border bg-bg-elevated hover:bg-bg"
              }`}
            >
              {isUploading ? (
                <div className="w-full text-center space-y-3">
                  <div className="flex items-center justify-between text-xs text-text-secondary font-semibold px-2">
                    <span className="truncate max-w-[200px]">{fileName}</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-bg-surface h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-accent h-full transition-all duration-150"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-text-muted block font-medium">
                    Uploading to secure academic repository...
                  </span>
                </div>
              ) : fileUrl ? (
                <div className="text-center space-y-2">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-accent/10 border border-accent/20 text-accent mb-1">
                    <FileText className="w-6 h-6" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                  </div>
                  <p className="text-sm font-semibold text-text-primary truncate max-w-[320px]">{fileName || "Document Attached"}</p>
                  <p className="text-xs text-text-secondary font-medium">
                    {(fileSize / (1024 * 1024)).toFixed(2)} MB • Ready to save
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setFileUrl("");
                      setFileName("");
                      setSelectedFile(null);
                    }}
                    className="text-xs text-like hover:text-like/80 font-semibold underline underline-offset-4 mt-2 focus:outline-none"
                  >
                    Remove file
                  </button>
                </div>
              ) : (
                <div className="text-center space-y-2 select-none">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-bg-surface text-text-secondary mb-1">
                    <Upload className="w-6 h-6" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                  </div>
                  <p className="text-sm font-semibold text-text-primary">
                    Drag and drop your document here
                  </p>
                  <p className="text-xs text-text-secondary font-medium">
                    Supports PDF, DOCX, PPTX up to 25MB
                  </p>
                  <label className="inline-block mt-2">
                    <span className="text-xs text-accent hover:underline font-semibold cursor-pointer focus:outline-none select-none">
                      Browse Files
                    </span>
                    <input
                      type="file"
                      className="hidden"
                      onChange={handleFileChange}
                      accept=".pdf,.docx,.doc,.pptx,.ppt,.txt"
                    />
                  </label>
                </div>
              )}
            </div>
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
              disabled={!title.trim() || !fileUrl}
            >
              Upload Material
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
