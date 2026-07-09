import logging
import uuid
from datetime import datetime, timezone
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.notification import Notification, NotificationType
from app.models.user import User
from app.schemas.notification import NotificationResponse
from app.websocket.manager import manager

logger = logging.getLogger(__name__)


async def _push_notification(notification: Notification) -> None:
    """Best-effort WS push of a new notification to its recipient.

    Serializes via NotificationResponse to match the REST shape the
    frontend already consumes. Failures are logged and swallowed so a
    flaky WS connection never breaks the DB write path.
    """
    try:
        payload = NotificationResponse.model_validate(notification).model_dump(mode="json")
        await manager.send_to_user(
            str(notification.user_id),
            {"type": "notification", "payload": payload},
        )
    except Exception as exc:
        logger.warning("WS push for notification %s failed: %s", notification.id, exc)


class NotificationService:
    """Handles creation, retrieval, and read-state for in-app notifications."""

    async def get_notifications(
        self,
        user_id: uuid.UUID,
        db: AsyncSession,
        cursor: str | None = None,
        limit: int = 20,
    ) -> tuple[list[Notification], str | None, bool]:
        query = (
            select(Notification)
            .options(selectinload(Notification.actor).selectinload(User.profile))
            .where(Notification.user_id == user_id)
            .order_by(Notification.created_at.desc())
            .limit(limit + 1)
        )
        if cursor:
            cursor_dt = datetime.fromisoformat(cursor)
            query = query.where(Notification.created_at < cursor_dt)

        result = await db.execute(query)
        notifications = result.scalars().unique().all()

        has_more = False
        next_cursor = None
        if len(notifications) > limit:
            has_more = True
            notifications = notifications[:limit]
            next_cursor = notifications[-1].created_at.isoformat()

        return list(notifications), next_cursor, has_more

    async def get_unread_count(self, user_id: uuid.UUID, db: AsyncSession) -> int:
        result = await db.execute(
            select(func.count(Notification.id)).where(
                Notification.user_id == user_id,
                Notification.is_read == False,
            )
        )
        return result.scalar() or 0

    async def mark_read(
        self,
        user_id: uuid.UUID,
        notification_ids: list[uuid.UUID],
        db: AsyncSession,
    ) -> int:
        result = await db.execute(
            update(Notification)
            .where(
                Notification.id.in_(notification_ids),
                Notification.user_id == user_id,
            )
            .values(is_read=True, updated_at=datetime.now(timezone.utc))
        )
        await db.flush()
        return result.rowcount

    async def mark_all_read(self, user_id: uuid.UUID, db: AsyncSession) -> int:
        result = await db.execute(
            update(Notification)
            .where(
                Notification.user_id == user_id,
                Notification.is_read == False,
            )
            .values(is_read=True, updated_at=datetime.now(timezone.utc))
        )
        await db.flush()
        return result.rowcount

    async def create_notification(
        self,
        user_id: uuid.UUID,
        type: NotificationType,
        title: str,
        body: str | None = None,
        data: dict | None = None,
        actor_id: uuid.UUID | None = None,
        db: AsyncSession | None = None,
    ) -> Notification | None:
        if db is None:
            return None
        if user_id == actor_id:
            return None
        notification = Notification(
            user_id=user_id,
            type=type,
            title=title,
            body=body,
            data=data,
            actor_id=actor_id,
        )
        db.add(notification)
        await db.flush()
        result = await db.execute(
            select(Notification)
            .options(selectinload(Notification.actor).selectinload(User.profile))
            .where(Notification.id == notification.id)
        )
        notification = result.scalar_one()
        # Best-effort real-time WS push; never blocks the DB write.
        await _push_notification(notification)

        # Best-effort mobile push notification via Expo. Enqueued as a
        # background job so the request path isn't blocked on the Expo API
        # call; if the worker/Redis is unavailable the job is a no-op.
        try:
            from app.worker.enqueue import enqueue_job

            await enqueue_job(
                "send_notification_job",
                user_id=str(user_id),
                title=title,
                body=body or "",
                url=(data or {}).get("url"),
            )
        except Exception as exc:
            logger.warning("Failed to enqueue push for notification %s: %s", notification.id, exc)

        return notification


def get_notification_service() -> NotificationService:
    return NotificationService()
