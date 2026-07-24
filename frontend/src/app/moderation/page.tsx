"use client";

import { useState, useEffect, useCallback } from "react";
import { Shield, Loader2, Filter, Trash2, CheckCircle } from "lucide-react";
import { LayoutShell } from "@/components/layout/LayoutShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAuth } from "@/context/auth-context";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ModerationAnalytics } from "@/components/moderation-analytics";
import { ReportCard } from "@/components/report-card";
import type { ReportData } from "@/types/moderation";

const STATUS_FILTERS = ["", "pending", "reviewing", "resolved", "dismissed"] as const;
const TARGET_FILTERS = ["", "post", "comment", "user", "listing", "club", "message"] as const;
const CATEGORY_FILTERS = ["", "spam", "hate_speech", "misinformation", "inappropriate", "harassment", "other"] as const;

const STATUS_LABELS: Record<string, string> = {
  "": "All Status",
  pending: "Pending",
  reviewing: "Reviewing",
  resolved: "Resolved",
  dismissed: "Dismissed",
};

const TARGET_LABELS: Record<string, string> = {
  "": "All Types",
  post: "Post",
  comment: "Comment",
  user: "User",
  listing: "Listing",
  club: "Club",
  message: "Message",
};

const CATEGORY_LABELS: Record<string, string> = {
  "": "All Categories",
  spam: "Spam",
  hate_speech: "Hate Speech",
  misinformation: "Misinformation",
  inappropriate: "Inappropriate",
  harassment: "Harassment",
  other: "Other",
};

function FilterSelect({
  label,
  value,
  onChange,
  options,
  labels,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  labels: Record<string, string>;
}) {
  const items = options.filter(Boolean);
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-auto min-w-[112px] gap-1.5 rounded-lg border-border bg-surface px-2.5 text-[11px] font-semibold text-text-primary shadow-none outline-none transition-colors hover:border-border-strong focus:ring-2 focus:ring-accent/30 data-[state=open]:border-accent/50 [&>span]:line-clamp-1">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent className="rounded-xl border-border bg-popover p-1 text-popover-foreground shadow-lg">
        {items.map((o) => (
          <SelectItem key={o} value={o} className="rounded-md text-[13px]">
            {labels[o] ?? o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function ModerationPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [targetFilter, setTargetFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const isModerator = user?.role === "moderator" || user?.role === "university_staff";

  const fetchReports = useCallback(
    async (cursor?: string, append = false) => {
      if (!isModerator) return;
      if (!append) setLoading(true);
      else setLoadingMore(true);
      try {
        const params: Record<string, string | number> = { limit: 20 };
        if (statusFilter) params.status = statusFilter;
        if (targetFilter) params.target_type = targetFilter;
        if (categoryFilter) params.category = categoryFilter;
        if (cursor) params.cursor = cursor;

        const res = await apiClient.get("/moderation/reports", { params });
        const data = res.data;
        const items = Array.isArray(data.items) ? data.items : Array.isArray(data) ? data : [];

        if (append) {
          setReports((prev) => [...prev, ...items]);
        } else {
          setReports(items);
        }
        setNextCursor(data.next_cursor || null);
        setHasMore(data.has_more || false);
      } catch {
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [isModerator, statusFilter, targetFilter, categoryFilter]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchReports();
  }, [fetchReports, refreshKey]);

  const handleLoadMore = () => {
    if (nextCursor && !loadingMore) {
      fetchReports(nextCursor, true);
    }
  };

  const handleUpdated = () => {
    setRefreshKey((k) => k + 1);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === reports.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(reports.map((r) => r.id)));
    }
  };

  const handleBulkAction = async (status: "resolved" | "dismissed") => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      await apiClient.post("/moderation/reports/bulk", {
        report_ids: Array.from(selectedIds),
        status,
      });
      handleUpdated();
    } catch {
    } finally {
      setBulkLoading(false);
    }
  };

  if (!user) return null;

  if (!isModerator) {
    return (
      <LayoutShell>
        <PageHeader title="Moderation" />
        <div className="flex flex-col items-center justify-center gap-2 p-20 text-center">
          <Shield className="h-8 w-8 text-text-secondary" />
          <p className="text-sm font-semibold text-text-primary">Moderators only</p>
          <p className="text-xs text-text-secondary">You don&apos;t have permission to view this page.</p>
        </div>
      </LayoutShell>
    );
  }

  return (
    <LayoutShell hideRightRail>
      <PageHeader title="Moderation" />

      <div className="px-6 py-4">
        <ModerationAnalytics key={refreshKey} />
      </div>

      <div className="px-6 pb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-3.5 w-3.5 text-text-tertiary" />
          <FilterSelect
            label="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_FILTERS}
            labels={STATUS_LABELS}
          />
          <FilterSelect
            label="Type"
            value={targetFilter}
            onChange={setTargetFilter}
            options={TARGET_FILTERS}
            labels={TARGET_LABELS}
          />
          <FilterSelect
            label="Category"
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={CATEGORY_FILTERS}
            labels={CATEGORY_LABELS}
          />
          <span className="text-[11px] text-text-tertiary ml-2">
            {reports.length} report{reports.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="mx-6 mb-4 p-3 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={toggleSelectAll} className="text-xs font-semibold text-accent hover:text-accent/80">
              {selectedIds.size === reports.length ? "Deselect all" : "Select all"}
            </button>
            <span className="text-xs text-text-tertiary">{selectedIds.size} selected</span>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleBulkAction("dismissed")}
              isLoading={bulkLoading}
              className="gap-1.5"
            >
              <Trash2 className="h-3 w-3" />
              Dismiss all
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => handleBulkAction("resolved")}
              isLoading={bulkLoading}
              className="gap-1.5"
            >
              <CheckCircle className="h-3 w-3" />
              Resolve all
            </Button>
          </div>
        </div>
      )}

      <div className="px-6 pb-8">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 text-accent animate-spin" />
          </div>
        ) : reports.length === 0 ? (
          <div className="py-12 text-center">
            <Shield className="h-10 w-10 text-text-tertiary mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-sm font-semibold text-text-secondary">No reports found.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((report, i) => (
              <div
                key={report.id}
                className="animate-fade-in"
                style={{ animationDelay: `${Math.min(i * 30, 150)}ms` }}
              >
                <ReportCard
                  report={report}
                  onUpdated={handleUpdated}
                  selected={selectedIds.has(report.id)}
                  onToggleSelect={toggleSelect}
                  showCheckbox
                />
              </div>
            ))}

            {hasMore && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="secondary"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="gap-1.5"
                >
                  {loadingMore ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  Load more
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </LayoutShell>
  );
}
