"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api-error";

const REPORT_CATEGORIES = [
  { value: "spam", label: "Spam" },
  { value: "hate_speech", label: "Hate speech" },
  { value: "misinformation", label: "Misinformation" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "harassment", label: "Harassment" },
  { value: "other", label: "Other" },
];

interface ReportModalProps {
  targetType: "post" | "comment" | "user" | "listing" | "club" | "message";
  targetId: string;
  onClose: () => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({ targetType, targetId, onClose }) => {
  const [category, setCategory] = useState("spam");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      await apiClient.post(`/reports`, {
        target_type: targetType,
        target_id: targetId,
        category,
        description: description.trim() || null,
      });
      setSubmitted(true);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to submit report."));
    } finally {
      setIsLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md bg-bg-surface border border-border bg-bg-main shadow-2xl rounded-3xl p-6 sm:p-8 animate-pop-in relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-6 top-6 p-2 rounded-xl text-text-muted hover:text-text-main hover:bg-[rgba(var(--bg-hover),0.08)] focus:outline-none"
          aria-label="Close modal"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

        {submitted ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-2xl bg-accent text-text-inverse flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-text-main mb-2">Report submitted</h3>
            <p className="text-sm text-text-muted">Moderators will review it shortly.</p>
            <div className="mt-6">
              <Button type="button" onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-bold tracking-tight text-text-main mb-2">Report post</h2>
            <p className="text-sm text-text-muted mb-6">Why are you reporting this post? Your report is anonymous.</p>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-950/40 border border-red-500/20 text-xs font-semibold text-red-400 text-center">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="flex flex-col gap-2">
                <label htmlFor="report-category" className="text-xs font-bold text-text-muted select-none">
                  CATEGORY
                </label>
                <select
                  id="report-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full min-h-[44px] px-4 rounded-xl bg-bg-surface border border-border focus:border-accent focus:ring-4 focus:ring-accent/20 text-text-main font-medium text-sm transition-all duration-200 outline-none appearance-none"
                >
                  {REPORT_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="report-desc" className="text-xs font-bold text-text-muted select-none">
                  ADDITIONAL DETAILS (OPTIONAL)
                </label>
                <textarea
                  id="report-desc"
                  placeholder="Provide any extra context..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={2000}
                  className="w-full min-h-[100px] p-4 rounded-xl bg-bg-surface border border-border focus:border-accent focus:ring-4 focus:ring-accent/20 text-text-main font-medium text-sm placeholder:text-text-muted transition-all duration-200 outline-none resize-none"
                />
              </div>

              <div className="flex gap-4 justify-end mt-6">
                <Button type="button" variant="secondary" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={isLoading}>
                  Submit report
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>,
    document.body
  );
};
