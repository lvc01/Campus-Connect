import uuid
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_current_user_allow_inactive, require_role
from app.models.user import User, UserRole
from app.models.moderation import ReportCategory, ReportPriority, ReportStatus, ReportTargetType, AppealStatus
from app.schemas.common import MessageResponse
from app.schemas.moderation import (
    AppealCreate,
    AppealListResponse,
    AppealOut,
    AppealUpdate,
    AuditLogListResponse,
    AuditLogOut,
    BulkReportAction,
    BulkReportResponse,
    ContentPreview,
    EnhancedStatsResponse,
    PlatformStatsResponse,
    ReportCreate,
    ReportListResponse,
    ReportOut,
    ReportUpdate,
)
from app.services.moderation_service import get_moderation_service

router = APIRouter(tags=["Moderation"])
service = get_moderation_service()


# ── Generic report endpoint (any authenticated user) ─────────────────


@router.post(
    "/reports",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="File a report against any entity",
)
async def create_report(
    data: ReportCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    await service.create_report(current_user.id, data, db)
    return MessageResponse(message="Report submitted.")


@router.post(
    "/reports/{report_id}/appeal",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="File an appeal against a moderation outcome",
)
async def create_appeal(
    report_id: uuid.UUID,
    data: AppealCreate,
    current_user: User = Depends(get_current_user_allow_inactive),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """File an appeal. Reachable even by suspended users (who need it most).

    Uses ``get_current_user_allow_inactive`` rather than ``get_current_user``
    so a deactivated/suspended account can still authenticate and contest the
    action. Ownership (reporter or target) is enforced in the service layer.
    """
    await service.create_appeal(report_id, current_user.id, data.reason, db)
    return MessageResponse(message="Appeal submitted.")


# ── Moderator-only endpoints ─────────────────────────────────────────

mod_router = APIRouter(
    prefix="/moderation",
    tags=["Moderation"],
    dependencies=[Depends(require_role(UserRole.moderator, UserRole.university_staff))],
)


@mod_router.get(
    "/reports",
    response_model=ReportListResponse,
    summary="List reports (moderator+ only)",
)
async def list_reports(
    cursor: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    status: ReportStatus | None = Query(default=None),
    target_type: ReportTargetType | None = Query(default=None),
    category: ReportCategory | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReportListResponse:
    reports, next_cursor, has_more, total = await service.list_reports(
        db, cursor, limit, status, target_type, category,
    )
    items = [ReportOut.model_validate(r) for r in reports]
    return ReportListResponse(
        items=items,
        next_cursor=next_cursor,
        has_more=has_more,
        total=total,
    )


@mod_router.get(
    "/reports/{report_id}",
    response_model=ReportOut,
    summary="Get a single report",
)
async def get_report(
    report_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReportOut:
    report = await service.get_report(report_id, db)
    return ReportOut.model_validate(report)


@mod_router.patch(
    "/reports/{report_id}",
    response_model=ReportOut,
    summary="Update report status (resolve/dismiss)",
)
async def update_report(
    report_id: uuid.UUID,
    data: ReportUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReportOut:
    report = await service.update_report_status(report_id, current_user.id, data, db)
    return ReportOut.model_validate(report)


@mod_router.get(
    "/stats",
    response_model=PlatformStatsResponse,
    summary="Platform moderation statistics",
)
async def get_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PlatformStatsResponse:
    stats = await service.get_platform_stats(db)
    return PlatformStatsResponse(**stats)


@mod_router.get(
    "/pending-count",
    response_model=dict,
    summary="Count of pending reports (for nav badge)",
)
async def get_pending_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    count = await service.get_pending_count(db)
    return {"pending": count}


@mod_router.get(
    "/preview/{target_type}/{target_id}",
    response_model=ContentPreview,
    summary="Preview reported content",
)
async def preview_content(
    target_type: ReportTargetType,
    target_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ContentPreview:
    return await service.get_content_preview(target_type, target_id, db)


@mod_router.get(
    "/users/{user_id}/reports",
    response_model=ReportListResponse,
    summary="Get all reports against a specific user",
)
async def get_user_reports(
    user_id: uuid.UUID,
    cursor: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReportListResponse:
    reports, next_cursor, has_more, total = await service.get_user_reports(
        user_id, db, cursor, limit,
    )
    items = [ReportOut.model_validate(r) for r in reports]
    return ReportListResponse(
        items=items,
        next_cursor=next_cursor,
        has_more=has_more,
        total=total,
    )


@mod_router.post(
    "/reports/bulk",
    response_model=BulkReportResponse,
    summary="Bulk update multiple reports",
)
async def bulk_update_reports(
    data: BulkReportAction,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BulkReportResponse:
    updated, failed = await service.bulk_update_reports(
        data.report_ids, data.status, current_user.id, data.resolution_note, db,
    )
    return BulkReportResponse(updated=updated, failed=failed)


@mod_router.post(
    "/users/{user_id}/suspend",
    response_model=dict,
    summary="Suspend a user for a duration",
)
async def suspend_user(
    user_id: uuid.UUID,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    duration_hours = data.get("duration_hours", 24)
    reason = data.get("reason", "Moderation action")
    await service.suspend_user(user_id, duration_hours, reason, current_user.id, db)
    return {"message": f"User suspended for {duration_hours} hours."}


@mod_router.post(
    "/users/{user_id}/reactivate",
    response_model=dict,
    summary="Reactivate a suspended or deactivated user",
)
async def reactivate_user(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    await service.reactivate_user(user_id, current_user.id, db)
    return {"message": "User reactivated."}


@mod_router.patch("/reports/{report_id}/assign", response_model=ReportOut, summary="Assign report to moderator")
async def assign_report(report_id: uuid.UUID, data: dict, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> ReportOut:
    report = await service.assign_report(report_id, uuid.UUID(data["assignee_id"]), current_user.id, db)
    return ReportOut.model_validate(report)

@mod_router.patch("/reports/{report_id}/notes", response_model=ReportOut, summary="Update internal notes")
async def update_notes(report_id: uuid.UUID, data: dict, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> ReportOut:
    report = await service.update_internal_notes(report_id, data.get("notes", ""), current_user.id, db)
    return ReportOut.model_validate(report)

@mod_router.patch("/reports/{report_id}/hide", response_model=ReportOut, summary="Toggle content visibility")
async def toggle_hidden(report_id: uuid.UUID, data: dict, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> ReportOut:
    report = await service.toggle_content_hidden(report_id, data.get("is_hidden", False), current_user.id, db)
    return ReportOut.model_validate(report)

@mod_router.patch("/reports/{report_id}/escalate", response_model=ReportOut, summary="Escalate report priority")
async def escalate_report(report_id: uuid.UUID, data: dict, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> ReportOut:
    report = await service.escalate_report(report_id, ReportPriority(data["priority"]), current_user.id, db)
    return ReportOut.model_validate(report)

@mod_router.get("/appeals", response_model=AppealListResponse, summary="List appeals (moderator+)")
async def list_appeals(status: AppealStatus | None = Query(default=None), cursor: str | None = Query(default=None), limit: int = Query(default=20, ge=1, le=100), current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> AppealListResponse:
    appeals, next_cursor, has_more, total = await service.list_appeals(db, status, cursor, limit)
    items = [AppealOut.model_validate(a) for a in appeals]
    return AppealListResponse(items=items, total=total)

@mod_router.patch("/appeals/{appeal_id}", response_model=AppealOut, summary="Review appeal")
async def review_appeal(appeal_id: uuid.UUID, data: AppealUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> AppealOut:
    appeal = await service.review_appeal(appeal_id, data, current_user.id, db)
    return AppealOut.model_validate(appeal)

@mod_router.get("/audit-log", response_model=AuditLogListResponse, summary="Moderation audit log")
async def get_audit_log(cursor: str | None = Query(default=None), limit: int = Query(default=50, ge=1, le=100), current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> AuditLogListResponse:
    logs, next_cursor, has_more, total = await service.get_audit_log(db, cursor, limit)
    items = [AuditLogOut.model_validate(l) for l in logs]
    return AuditLogListResponse(items=items, total=total, next_cursor=next_cursor, has_more=has_more)

@mod_router.get("/stats/enhanced", response_model=EnhancedStatsResponse, summary="Enhanced moderation statistics")
async def get_enhanced_stats(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> EnhancedStatsResponse:
    stats = await service.get_enhanced_stats(db)
    return EnhancedStatsResponse(**stats)

@mod_router.post("/auto-close", response_model=dict, summary="Auto-close stale reports (30+ days)")
async def auto_close_stale(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> dict:
    count = await service.auto_close_stale(db)
    return {"closed": count}


# Mount mod_router under the main router
router.include_router(mod_router)
