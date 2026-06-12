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

export interface ModerationStats {
  total_reports: number;
  pending: number;
  reviewing: number;
  resolved: number;
  dismissed: number;
  by_category: Record<string, number>;
  by_target_type: Record<string, number>;
  resolved_today: number;
  pending_oldest: string | null;
}

export interface EnhancedStats extends ModerationStats {
  resolved_this_week: number;
  avg_resolution_hours: number | null;
  by_priority: Record<string, number>;
  sla_breached: number;
}

export interface ContentPreview {
  target_type: string;
  target_id: string;
  title: string | null;
  content: string | null;
  author_name: string | null;
  author_avatar: string | null;
  image_url: string | null;
  extra: Record<string, unknown> | null;
  is_deleted: boolean;
}

export interface BulkReportAction {
  report_ids: string[];
  status: "resolved" | "dismissed" | "reviewing" | "pending";
  resolution_note?: string;
}

export interface BulkReportResponse {
  updated: number;
  failed: number;
}

export interface AppealData {
  id: string;
  report_id: string;
  user: { id: string; email: string; profile: { display_name: string } | null };
  reason: string;
  status: string;
  reviewer: { id: string; email: string; profile: { display_name: string } | null } | null;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  moderator: { id: string; email: string; profile: { display_name: string } | null };
  action: string;
  target_type: string;
  target_id: string;
  details: Record<string, unknown> | null;
  created_at: string;
}
