from datetime import datetime
import uuid

from pydantic import BaseModel, ConfigDict, Field

from app.models.moderation import ReportCategory, ReportPriority, ReportStatus, ReportTargetType, AppealStatus
from app.schemas.user import UserResponse


class ReportCreate(BaseModel):
    target_type: ReportTargetType | None = None
    target_id: uuid.UUID | None = None
    category: ReportCategory
    description: str | None = Field(default=None, max_length=2000)


class ReportUpdate(BaseModel):
    status: ReportStatus
    resolution_note: str | None = Field(default=None, max_length=2000)
    priority: ReportPriority | None = None
    assigned_to: uuid.UUID | None = None
    internal_notes: str | None = Field(default=None, max_length=5000)


class ReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    reporter: UserResponse
    target_type: ReportTargetType
    target_id: uuid.UUID
    category: ReportCategory
    description: str | None = None
    status: ReportStatus
    reviewed_by: uuid.UUID | None = None
    reviewer: UserResponse | None = None
    resolution_note: str | None = None
    resolved_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    priority: ReportPriority = ReportPriority.medium
    assigned_to: uuid.UUID | None = None
    assignee: UserResponse | None = None
    internal_notes: str | None = None
    is_hidden: bool = False
    sla_deadline: datetime | None = None


class ReportListResponse(BaseModel):
    items: list[ReportOut]
    next_cursor: str | None = None
    has_more: bool = False
    total: int = 0


class PlatformStatsResponse(BaseModel):
    total_reports: int = 0
    pending: int = 0
    reviewing: int = 0
    resolved: int = 0
    dismissed: int = 0
    by_category: dict[str, int] = {}
    by_target_type: dict[str, int] = {}
    resolved_today: int = 0
    pending_oldest: datetime | None = None


class ContentPreview(BaseModel):
    """Preview of reported content for moderator review."""
    target_type: str
    target_id: str
    title: str | None = None
    content: str | None = None
    author_name: str | None = None
    author_avatar: str | None = None
    image_url: str | None = None
    extra: dict | None = None
    is_deleted: bool = False


class BulkReportAction(BaseModel):
    report_ids: list[uuid.UUID]
    status: ReportStatus
    resolution_note: str | None = Field(default=None, max_length=2000)


class BulkReportResponse(BaseModel):
    updated: int = 0
    failed: int = 0


class AppealCreate(BaseModel):
    reason: str = Field(max_length=2000)


class AppealUpdate(BaseModel):
    status: AppealStatus  # "approved" or "denied"
    review_note: str | None = Field(default=None, max_length=2000)


class AppealOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    report_id: uuid.UUID
    user: UserResponse
    reason: str
    status: AppealStatus
    reviewer: UserResponse | None = None
    review_note: str | None = None
    reviewed_at: datetime | None = None
    created_at: datetime


class AppealListResponse(BaseModel):
    items: list[AppealOut]
    total: int = 0


class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    moderator: UserResponse
    action: str
    target_type: str
    target_id: str
    details: dict | None = None
    created_at: datetime


class AuditLogListResponse(BaseModel):
    items: list[AuditLogOut]
    total: int = 0
    next_cursor: str | None = None
    has_more: bool = False


class EnhancedStatsResponse(PlatformStatsResponse):
    resolved_this_week: int = 0
    avg_resolution_hours: float | None = None
    by_priority: dict[str, int] = {}
    by_assignee: dict[str, int] = {}
    sla_breached: int = 0
