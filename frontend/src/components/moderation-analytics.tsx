"use client";

import React, { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";

interface EnhancedStatsData {
  total_reports: number;
  pending: number;
  reviewing: number;
  resolved: number;
  dismissed: number;
  by_category: Record<string, number>;
  by_target_type: Record<string, number>;
  resolved_today: number;
  pending_oldest: string | null;
  resolved_this_week: number;
  avg_resolution_hours: number | null;
  by_priority: Record<string, number>;
  sla_breached: number;
}

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

const PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "text-text-tertiary",
  medium: "text-text-secondary",
  high: "text-warning",
  urgent: "text-error",
};

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-1">
      <p className="text-xs font-bold tracking-widest text-text-tertiary uppercase">{label}</p>
      <p className={`text-2xl font-black ${color}`}>{value}</p>
    </div>
  );
}

function BreakdownList({ data, labels }: { data: Record<string, number>; labels: Record<string, string> }) {
  const entries = Object.entries(data).sort(([, a], [, b]) => b - a);
  const total = entries.reduce((sum, [, v]) => sum + v, 0);

  if (entries.length === 0) {
    return <p className="text-xs text-text-tertiary py-4 text-center">No data yet.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {entries.map(([key, count]) => (
        <div key={key} className="flex items-center gap-3">
          <span className="text-xs font-semibold text-text-primary w-24 shrink-0">{labels[key] || key}</span>
          <div className="flex-1 h-2 rounded-full bg-border overflow-hidden">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${total > 0 ? (count / total) * 100 : 0}%` }}
            />
          </div>
          <span className="text-xs font-bold text-text-tertiary w-8 text-right">{count}</span>
        </div>
      ))}
    </div>
  );
}

export function ModerationAnalytics() {
  const [stats, setStats] = useState<EnhancedStatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const resp = await apiClient.get("/moderation/stats/enhanced");
        setStats(resp.data);
      } catch (err) {
        console.error("Failed to load moderation stats", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 animate-pulse">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="bg-surface border border-border rounded-xl p-4 h-20" />
        ))}
      </div>
    );
  }

  if (!stats) {
    return <p className="text-sm text-text-tertiary">Failed to load stats.</p>;
  }

  const avgResStr = stats.avg_resolution_hours != null
    ? stats.avg_resolution_hours < 24
      ? `${Math.round(stats.avg_resolution_hours)}h`
      : `${(stats.avg_resolution_hours / 24).toFixed(1)}d`
    : "N/A";

  return (
    <div className="flex flex-col gap-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard label="Total" value={stats.total_reports} color="text-text-primary" />
        <StatCard label="Pending" value={stats.pending} color="text-warning" />
        <StatCard label="Reviewing" value={stats.reviewing} color="text-sky-400" />
        <StatCard label="Resolved" value={stats.resolved} color="text-success" />
        <StatCard label="Dismissed" value={stats.dismissed} color="text-text-tertiary" />
      </div>

      {/* Enhanced stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-4">
        <StatCard label="This Week" value={stats.resolved_this_week} color="text-success" />
        <StatCard label="Avg Resolution" value={avgResStr} color="text-sky-400" />
        <StatCard label="SLA Breached" value={stats.sla_breached} color="text-error" />
      </div>

      {/* Today's resolution */}
      <div className="bg-surface border border-border rounded-xl p-5 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold tracking-widest text-text-tertiary uppercase">Resolved Today</p>
          <p className="text-3xl font-black text-success mt-1">{stats.resolved_today}</p>
        </div>
        {stats.pending_oldest && (
          <div className="text-right">
            <p className="text-xs font-bold tracking-widest text-text-tertiary uppercase">Oldest Pending</p>
              <p className="text-sm font-semibold text-warning mt-1">
              {new Date(stats.pending_oldest).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          </div>
        )}
      </div>

      {/* Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface border border-border rounded-xl p-5">
          <h3 className="text-xs font-bold tracking-widest text-text-tertiary uppercase mb-4">By Category</h3>
          <BreakdownList data={stats.by_category} labels={CATEGORY_LABELS} />
        </div>
        <div className="bg-surface border border-border rounded-xl p-5">
          <h3 className="text-xs font-bold tracking-widest text-text-tertiary uppercase mb-4">By Target Type</h3>
          <BreakdownList data={stats.by_target_type} labels={TARGET_LABELS} />
        </div>
      </div>

      {/* Priority breakdown */}
      <div className="bg-surface border border-border rounded-xl p-5">
        <h3 className="text-xs font-bold tracking-widest text-text-tertiary uppercase mb-4">By Priority</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Object.entries(PRIORITY_LABELS).map(([key, label]) => (
            <div key={key} className="flex flex-col items-center gap-1">
              <span className={`text-2xl font-black ${PRIORITY_COLORS[key]}`}>{stats.by_priority[key] || 0}</span>
              <span className="text-xs font-semibold text-text-tertiary">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
