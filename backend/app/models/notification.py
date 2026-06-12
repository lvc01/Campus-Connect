"""
SQLAlchemy ORM model — Notification.

In-app notification center with typed notifications and JSONB
payload for flexible entity references.
"""

import enum
import uuid

from sqlalchemy import Boolean, Enum as SAEnum, ForeignKey, String, Text
from app.core.types import PortableJSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin


# ── Enums ─────────────────────────────────────────────────────────────

class NotificationType(str, enum.Enum):
    """Type of notification event."""

    like = "like"
    comment = "comment"
    follow = "follow"
    event_reminder = "event_reminder"
    club_announcement = "club_announcement"
    dm = "dm"
    mention = "mention"
    report_resolved = "report_resolved"
    report_new = "report_new"
    system = "system"


# ── Notification ──────────────────────────────────────────────────────

class Notification(Base, TimestampMixin):
    """
    An in-app notification delivered to a user.

    The ``data`` JSONB field stores contextual references (post_id,
    club_id, etc.) so the frontend can deep-link to the right screen.
    The ``actor_id`` identifies who triggered the notification.
    """

    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    type: Mapped[NotificationType] = mapped_column(
        SAEnum(NotificationType, name="notification_type", create_constraint=True),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    data: Mapped[dict | None] = mapped_column(PortableJSON, nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )

    # ── Relationships ─────────────────────────────────────────────────
    user: Mapped["User"] = relationship(  # type: ignore[name-defined]
        back_populates="notifications", foreign_keys=[user_id],
    )
    actor: Mapped["User | None"] = relationship(foreign_keys=[actor_id])  # type: ignore[name-defined]

    def __repr__(self) -> str:
        return f"<Notification id={self.id} type={self.type.value} read={self.is_read}>"
