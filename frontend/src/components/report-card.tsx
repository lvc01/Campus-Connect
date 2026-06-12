"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp, Eye, Loader2, Trash2, History, Ban, UserCheck, AlertTriangle, ArrowUp, MessageSquare, UserPlus, EyeOff } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { getInitials, getRelativeTime } from "@/lib/utils";
import { getApiErrorMessage } from "@/lib/api-error";
import type { ContentPreview } from "@/types/moderation";

export interface ReportData {
  id: string;
  reporter: { id: string; email: string; profile: { display_name: string } | null };
  reviewer: { id: string; email: string; profile: { display_name: string } | null } | null;
  assignee: { id: string; email: string; profile: { display_name: string } | null } | null;
  target_type: string;
  target_id: string;
  category: string;
  description: string | null;
  status: string;
  priority: string;
  resolution_note: string | null;
  internal_notes: string | null;
  resolved_at: string | null;
  is_hidden: boolean;
  sla_deadline: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  reviewing: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  resolved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  dismissed: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

const CATEGORY_LABELS: Record<string, string> = {
  spam: "Spam",
  hate_speech: "Hate Speech",
  misinformation: "Misinformation",
  inappropriate: "Inappropriate",
  harassment: "Harassment",
  other: "Other",
};

const TARGET_LABELS: Record<string, string> = {
  post: "Post",
  comment: "Comment",
  user: "User",
  listing: "Listing",
  club: "Club",
  message: "Message",
};

const SUSPEND_DURATIONS = [
  { label: "1 day", hours: 24 },
  { label: "7 days", hours: 168 },
  { label: "30 days", hours: 720 },
];

interface ReportCardProps {
  report: ReportData;
  onUpdated: () => void;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  showCheckbox?: boolean;
  moderators?: { id: string; profile: { display_name: string } | null }[];
}

export function ReportCard({ report, onUpdated, selected, onToggleSelect, showCheckbox, moderators }: ReportCardProps) {
  const [resolutionNote, setResolutionNote] = useState(report.resolution_note || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<ContentPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [userReports, setUserReports] = useState<ReportData[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showSuspend, setShowSuspend] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showEscalate, setShowEscalate] = useState(false);
  const [internalNotes, setInternalNotes] = useState(report.internal_notes || "");
  const [showAppealForm, setShowAppealForm] = useState(false);
  const [appealReason, setAppealReason] = useState("");
  const [appeal, setAppeal] = useState<{ id: string; reason: string; status: string; review_note: string | null } | null>(null);
  const [loadingAppeal, setLoadingAppeal] = useState(false);

  const canAct = report.status === "pending" || report.status === "reviewing";

  const fetchPreview = async () => {
    if (preview || loadingPreview) return;
    setLoadingPreview(true);
    try {
      const res = await apiClient.get(`/moderation/preview/${report.target_type}/${report.target_id}`);
      setPreview(res.data);
    } catch {
      // Silently fail
    } finally {
      setLoadingPreview(false);
    }
  };

  const togglePreview = () => {
    if (!showPreview && !preview) fetchPreview();
    setShowPreview(!showPreview);
  };

  const fetchUserReports = async () => {
    if (userReports.length > 0 || loadingHistory) return;
    setLoadingHistory(true);
    try {
      const res = await apiClient.get(`/moderation/users/${report.target_id}/reports`, { params: { limit: 20 } });
      setUserReports(res.data.items || []);
    } catch {
      // Silently fail
    } finally {
      setLoadingHistory(false);
    }
  };

  const toggleHistory = () => {
    if (!showHistory) fetchUserReports();
    setShowHistory(!showHistory);
  };

  const handleAction = async (status: "resolved" | "dismissed") => {
    setIsSubmitting(true);
    setError("");
    try {
      await apiClient.patch(`/moderation/reports/${report.id}`, {
        status,
        resolution_note: resolutionNote.trim() || null,
      });
      onUpdated();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to update report."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartReview = async () => {
    setIsSubmitting(true);
    setError("");
    try {
      await apiClient.patch(`/moderation/reports/${report.id}`, { status: "reviewing" });
      onUpdated();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to update report."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSuspend = async (durationHours: number) => {
    setIsSubmitting(true);
    setError("");
    try {
      await apiClient.post(`/moderation/users/${report.target_id}/suspend`, {
        duration_hours: durationHours,
        reason: `Report: ${report.category}`,
      });
      setShowSuspend(false);
      onUpdated();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to suspend user."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReactivate = async () => {
    setIsSubmitting(true);
    setError("");
    try {
      await apiClient.post(`/moderation/users/${report.target_id}/reactivate`);
      onUpdated();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to reactivate user."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleHide = async () => {
    setIsSubmitting(true);
    setError("");
    try {
      await apiClient.patch(`/moderation/reports/${report.id}/hide`, { is_hidden: !report.is_hidden });
      onUpdated();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to update visibility."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEscalate = async (priority: string) => {
    setIsSubmitting(true);
    setError("");
    try {
      await apiClient.patch(`/moderation/reports/${report.id}/escalate`, { priority });
      setShowEscalate(false);
      onUpdated();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to escalate."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAssign = async (assigneeId: string) => {
    setIsSubmitting(true);
    setError("");
    try {
      await apiClient.patch(`/moderation/reports/${report.id}/assign`, { assignee_id: assigneeId });
      setShowAssign(false);
      onUpdated();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to assign."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveNotes = async () => {
    setIsSubmitting(true);
    setError("");
    try {
      await apiClient.patch(`/moderation/reports/${report.id}/notes`, { notes: internalNotes });
      setShowNotes(false);
      onUpdated();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to save notes."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchAppeal = async () => {
    if (loadingAppeal) return;
    setLoadingAppeal(true);
    try {
      const res = await apiClient.get(`/moderation/reports/${report.id}/appeal`);
      setAppeal(res.data);
    } catch {
      setAppeal(null);
    } finally {
      setLoadingAppeal(false);
    }
  };

  const handleFileAppeal = async () => {
    setIsSubmitting(true);
    setError("");
    try {
      await apiClient.post(`/moderation/reports/${report.id}/appeal`, { reason: appealReason.trim() });
      setShowAppealForm(false);
      setAppealReason("");
      fetchAppeal();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to file appeal."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`bg-bg-surface border rounded-xl p-5 flex flex-col gap-4 transition-colors ${selected ? "border-accent/50 bg-accent/5" : "border-border"}`}>
      {/* Header: checkbox + reporter + status */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {showCheckbox && onToggleSelect && (
            <input
              type="checkbox"
              checked={selected || false}
              onChange={() => onToggleSelect(report.id)}
              className="h-4 w-4 rounded border-border accent-accent shrink-0"
            />
          )}
          <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-text-inverse">{getInitials(report.reporter?.profile?.display_name || "")}</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-text-primary truncate">{report.reporter?.profile?.display_name || "Unknown"}</p>
            <p className="text-[11px] text-text-muted">{report.reporter?.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${STATUS_COLORS[report.status] || "bg-bg-surface text-text-muted"}`}>
            {report.status}
          </span>
          <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${
            report.priority === "urgent" ? "bg-red-500/10 text-red-400 border-red-500/20" :
            report.priority === "high" ? "bg-orange-500/10 text-orange-400 border-orange-500/20" :
            report.priority === "low" ? "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" :
            ""
          }`}>
            {report.priority !== "medium" ? report.priority : ""}
          </span>
          <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-bg-surface text-text-muted border border-border">
            {CATEGORY_LABELS[report.category] || report.category}
          </span>
        </div>
      </div>

      {/* Target info */}
      <div className="flex items-center gap-2 text-xs text-text-secondary">
        <span className="font-semibold text-accent">{TARGET_LABELS[report.target_type] || report.target_type}</span>
        <span className="text-text-muted">ID: {report.target_id.slice(0, 8)}...</span>
        <span className="text-text-muted">·</span>
        <span>{getRelativeTime(report.created_at)}</span>
      </div>

      {/* SLA warning */}
      {report.sla_deadline && new Date(report.sla_deadline) < new Date() && (report.status === "pending" || report.status === "reviewing") && (
        <div className="flex items-center gap-1.5 text-xs font-semibold text-red-400">
          <AlertTriangle className="h-3.5 w-3.5" />
          SLA breached
        </div>
      )}

      {/* Description */}
      {report.description && (
        <p className="text-sm text-text-primary leading-relaxed bg-bg-surface/50 rounded-lg p-3 border border-border/50">
          {report.description}
        </p>
      )}

      {/* Action toggles */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={togglePreview}
          className="flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent/80 transition-colors"
        >
          {showPreview ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {showPreview ? "Hide content" : "Preview content"}
        </button>
        {report.target_type === "user" && (
          <button
            onClick={toggleHistory}
            className="flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent/80 transition-colors"
          >
            <History className="h-3.5 w-3.5" />
            {showHistory ? "Hide history" : "Report history"}
          </button>
        )}
        <button
          onClick={handleToggleHide}
          className="flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent/80 transition-colors"
        >
          {report.is_hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          {report.is_hidden ? "Unhide" : "Hide"}
        </button>
        {canAct && (
          <div className="relative">
            <button
              onClick={() => { setShowEscalate(!showEscalate); setShowAssign(false); }}
              className="flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent/80 transition-colors"
            >
              <ArrowUp className="h-3.5 w-3.5" />
              Escalate
            </button>
            {showEscalate && (
              <div className="absolute z-10 top-7 left-0 bg-bg-surface border border-border rounded-lg shadow-lg p-1 min-w-[120px]">
                {["low", "medium", "high", "urgent"].map((p) => (
                  <button
                    key={p}
                    onClick={() => handleEscalate(p)}
                    className="w-full text-left px-3 py-1.5 text-xs font-semibold text-text-primary hover:bg-accent/10 rounded capitalize"
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {canAct && moderators && (
          <div className="relative">
            <button
              onClick={() => { setShowAssign(!showAssign); setShowEscalate(false); }}
              className="flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent/80 transition-colors"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Assign
            </button>
            {showAssign && (
              <div className="absolute z-10 top-7 left-0 bg-bg-surface border border-border rounded-lg shadow-lg p-1 min-w-[160px] max-h-48 overflow-y-auto">
                {moderators.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => handleAssign(m.id)}
                    className="w-full text-left px-3 py-1.5 text-xs font-semibold text-text-primary hover:bg-accent/10 rounded"
                  >
                    {m.profile?.display_name || m.id.slice(0, 8)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {canAct && (
          <button
            onClick={() => setShowNotes(!showNotes)}
            className="flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent/80 transition-colors"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Notes
          </button>
        )}
      </div>

      {/* Internal notes */}
      {showNotes && (
        <div className="border border-border/50 rounded-xl p-4 bg-bg-surface/30 space-y-2">
          <p className="text-xs font-bold text-text-primary">Internal Notes</p>
          <textarea
            placeholder="Add internal notes..."
            value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)}
            maxLength={2000}
            className="w-full min-h-[60px] p-3 rounded-xl bg-bg-surface border border-border focus:border-accent focus:ring-4 focus:ring-accent/20 text-text-primary font-medium text-sm placeholder:text-text-muted transition-all duration-200 outline-none resize-none"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowNotes(false)} isLoading={isSubmitting} className="text-xs">
              Cancel
            </Button>
            <Button type="button" onClick={handleSaveNotes} isLoading={isSubmitting} className="text-xs">
              Save Notes
            </Button>
          </div>
        </div>
      )}

      {/* Content preview */}
      {showPreview && (
        <div className="border border-border/50 rounded-xl p-4 bg-bg-surface/30 space-y-3">
          {loadingPreview ? (
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading preview...
            </div>
          ) : preview ? (
            <>
              {preview.is_deleted && (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-red-400">
                  <Trash2 className="h-3 w-3" />
                  Content has been deleted
                </div>
              )}
              {preview.author_name && (
                <div className="flex items-center gap-2">
                  {preview.author_avatar ? (
                    <img src={preview.author_avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center">
                      <span className="text-[8px] font-bold text-text-inverse">{getInitials(preview.author_name)}</span>
                    </div>
                  )}
                  <span className="text-xs font-semibold text-text-primary">{preview.author_name}</span>
                  {preview.title && preview.target_type === "user" && (
                    <span className="text-[11px] text-text-muted">{preview.title}</span>
                  )}
                </div>
              )}
              {preview.title && preview.target_type !== "user" && (
                <p className="text-sm font-bold text-text-primary">{preview.title}</p>
              )}
              {preview.content && (
                <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap line-clamp-6">
                  {preview.content}
                </p>
              )}
              {preview.image_url && (
                <img src={preview.image_url} alt="Preview" className="w-full max-h-48 object-cover rounded-lg border border-border/50" />
              )}
              {preview.extra && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {Object.entries(preview.extra).map(([key, val]) => (
                    <span key={key} className="text-[10px] font-semibold px-2 py-1 rounded-full bg-bg-surface text-text-muted border border-border/50">
                      {key}: {String(val)}
                    </span>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-text-muted">No preview available.</p>
          )}
        </div>
      )}

      {/* User report history */}
      {showHistory && (
        <div className="border border-border/50 rounded-xl p-4 bg-bg-surface/30 space-y-3">
          {loadingHistory ? (
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading history...
            </div>
          ) : userReports.length > 0 ? (
            <>
              <p className="text-xs font-bold text-text-primary">{userReports.length} report(s) against this user</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {userReports.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 text-xs p-2 rounded-lg bg-bg-surface/50 border border-border/30">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${r.status === "resolved" ? "bg-emerald-400" : r.status === "dismissed" ? "bg-zinc-400" : "bg-amber-400"}`} />
                    <span className="font-semibold text-text-primary">{CATEGORY_LABELS[r.category] || r.category}</span>
                    <span className="text-text-muted">·</span>
                    <span className="text-text-muted">{getRelativeTime(r.created_at)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-text-muted">No prior reports against this user.</p>
          )}
        </div>
      )}

      {/* Reviewer info */}
      {report.reviewer && (
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span>Reviewed by</span>
          <span className="font-semibold text-text-primary">{report.reviewer?.profile?.display_name || "Moderator"}</span>
          {report.resolved_at && <span>· {getRelativeTime(report.resolved_at)}</span>}
        </div>
      )}

      {/* Resolution note */}
      {report.resolution_note && !canAct && (
        <p className="text-xs text-text-muted italic bg-bg-surface/30 rounded-lg p-3 border border-border/30">
          &ldquo;{report.resolution_note}&rdquo;
        </p>
      )}

      {/* Error */}
      {error && (
        <div className="p-3 rounded-xl bg-like/10 border border-like/20 text-xs font-semibold text-like text-center">
          {error}
        </div>
      )}

      {/* Actions */}
      {canAct && (
        <div className="flex flex-col gap-3 pt-2 border-t border-border/50">
          <textarea
            placeholder="Resolution note (optional)..."
            value={resolutionNote}
            onChange={(e) => setResolutionNote(e.target.value)}
            maxLength={2000}
            className="w-full min-h-[60px] p-3 rounded-xl bg-bg-surface border border-border focus:border-accent focus:ring-4 focus:ring-accent/20 text-text-primary font-medium text-sm placeholder:text-text-muted transition-all duration-200 outline-none resize-none"
          />
          <div className="flex gap-3 justify-end flex-wrap">
            {report.target_type === "user" && (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowSuspend(!showSuspend)}
                  isLoading={isSubmitting}
                  className="gap-1.5"
                >
                  <Ban className="h-3.5 w-3.5" />
                  Suspend
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleReactivate}
                  isLoading={isSubmitting}
                  className="gap-1.5"
                >
                  <UserCheck className="h-3.5 w-3.5" />
                  Reactivate
                </Button>
              </>
            )}
            {report.status === "pending" && (
              <Button
                type="button"
                variant="secondary"
                onClick={handleStartReview}
                isLoading={isSubmitting}
                className="gap-1.5"
              >
                <Eye className="h-3.5 w-3.5" />
                Start Review
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleAction("dismissed")}
              isLoading={isSubmitting}
            >
              Dismiss
            </Button>
            <Button
              type="button"
              onClick={() => handleAction("resolved")}
              isLoading={isSubmitting}
            >
              Resolve
            </Button>
          </div>
        </div>
      )}

      {/* Suspension duration picker */}
      {showSuspend && (
        <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
          <span className="text-xs text-text-muted self-center">Suspend for:</span>
          {SUSPEND_DURATIONS.map((d) => (
            <Button
              key={d.hours}
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleSuspend(d.hours)}
              isLoading={isSubmitting}
              className="text-xs"
            >
              {d.label}
            </Button>
          ))}
        </div>
      )}

      {/* Appeal section */}
      {!canAct && (
        <div className="pt-2 border-t border-border/50">
          {loadingAppeal ? (
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading appeal...
            </div>
          ) : appeal ? (
            <div className="bg-bg-surface/30 rounded-lg p-3 border border-border/30 space-y-1">
              <p className="text-xs font-bold text-text-primary">Appeal: <span className="capitalize">{appeal.status}</span></p>
              <p className="text-xs text-text-secondary">{appeal.reason}</p>
              {appeal.review_note && <p className="text-xs text-text-muted italic">Reviewer: {appeal.review_note}</p>}
            </div>
          ) : showAppealForm ? (
            <div className="space-y-2">
              <textarea
                placeholder="Reason for appeal..."
                value={appealReason}
                onChange={(e) => setAppealReason(e.target.value)}
                maxLength={1000}
                className="w-full min-h-[60px] p-3 rounded-xl bg-bg-surface border border-border focus:border-accent focus:ring-4 focus:ring-accent/20 text-text-primary font-medium text-sm placeholder:text-text-muted transition-all duration-200 outline-none resize-none"
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setShowAppealForm(false)} isLoading={isSubmitting} className="text-xs">
                  Cancel
                </Button>
                <Button type="button" onClick={handleFileAppeal} isLoading={isSubmitting} className="text-xs">
                  Submit Appeal
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="secondary"
              onClick={() => { setShowAppealForm(true); fetchAppeal(); }}
              className="gap-1.5 text-xs"
            >
              File Appeal
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
