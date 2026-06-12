import uuid
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.notification import (
    MarkReadRequest,
    NotificationListResponse,
    NotificationResponse,
    UnreadCountResponse,
)
from app.services.notification_service import get_notification_service

router = APIRouter(prefix="/notifications", tags=["Notifications"])
service = get_notification_service()


@router.get(
    "",
    response_model=NotificationListResponse,
    summary="Get paginated notifications for current user",
)
async def get_notifications(
    cursor: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NotificationListResponse:
    notifications, next_cursor, has_more = await service.get_notifications(
        current_user.id, db, cursor, limit,
    )
    unread_count = await service.get_unread_count(current_user.id, db)
    items = [NotificationResponse.model_validate(n) for n in notifications]
    return NotificationListResponse(
        items=items,
        unread_count=unread_count,
        next_cursor=next_cursor,
        has_more=has_more,
    )


@router.get(
    "/unread-count",
    response_model=UnreadCountResponse,
    summary="Get unread notification count",
)
async def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UnreadCountResponse:
    count = await service.get_unread_count(current_user.id, db)
    return UnreadCountResponse(unread_count=count)


@router.patch(
    "/read",
    response_model=UnreadCountResponse,
    summary="Mark specific notifications as read",
)
async def mark_read(
    data: MarkReadRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UnreadCountResponse:
    await service.mark_read(current_user.id, data.notification_ids, db)
    count = await service.get_unread_count(current_user.id, db)
    return UnreadCountResponse(unread_count=count)


@router.patch(
    "/read-all",
    response_model=UnreadCountResponse,
    summary="Mark all notifications as read",
)
async def mark_all_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UnreadCountResponse:
    await service.mark_all_read(current_user.id, db)
    return UnreadCountResponse(unread_count=0)
