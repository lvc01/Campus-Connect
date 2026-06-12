"""
SQLAlchemy ORM models — Report, ReportAppeal, ModerationAuditLog.

Content moderation via a polymorphic reporting system. Any entity
(post, comment, user, listing, club, message) can be reported
using the ``target_type`` + ``target_id`` pattern.
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin
from app.core.types import PortableJSON


# ── Enums ─────────────────────────────────────────────────────────────

class ReportTargetType(str, enum.Enum):
    """Entity type being reported."""

    post = "post"
    comment = "comment"
    user = "user"
    listing = "listing"
    club = "club"
    message = "message"


class ReportCategory(str, enum.Enum):
    """Category describing the nature of the report."""

    spam = "spam"
    hate_speech = "hate_speech"
    misinformation = "misinformation"
    inappropriate = "inappropriate"
    harassment = "harassment"
    other = "other"


class ReportStatus(str, enum.Enum):
    """Review lifecycle status of a report."""

    pending = "pending"
    reviewing = "reviewing"
    resolved = "resolved"
    dismissed = "dismissed"


class ReportPriority(str, enum.Enum):
    """Priority level for escalation."""

    low = "low"
    medium = "medium"
    high = "high"
    urgent = "urgent"


class AppealStatus(str, enum.Enum):
    """Status of a report appeal."""

    pending = "pending"
    approved = "approved"
    denied = "denied"


# ── Report ────────────────────────────────────────────────────────────

class Report(Base, TimestampMixin):
    """
    A content report filed by a user against any platform entity.

    Uses a polymorphic pattern (``target_type`` + ``target_id``)
    so a single table handles reports across all content types.
    Moderators review, resolve, or dismiss reports from the admin dashboard.
    """

    __tablename__ = "reports"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    reporter_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )
    target_type: Mapped[ReportTargetType] = mapped_column(
        SAEnum(ReportTargetType, name="report_target_type", create_constraint=True),
        nullable=False,
    )
    target_id: Mapped[uuid.UUID] = mapped_column(nullable=False)
    category: Mapped[ReportCategory] = mapped_column(
        SAEnum(ReportCategory, name="report_category", create_constraint=True),
        nullable=False,
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[ReportStatus] = mapped_column(
        SAEnum(ReportStatus, name="report_status", create_constraint=True),
        default=ReportStatus.pending,
    )
    priority: Mapped[ReportPriority] = mapped_column(
        SAEnum(ReportPriority, name="report_priority", create_constraint=True),
        default=ReportPriority.medium,
    )
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )
    resolution_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    internal_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    sla_deadline: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    is_hidden: Mapped[bool] = mapped_column(default=False)

    # ── Relationships ─────────────────────────────────────────────────
    reporter: Mapped["User"] = relationship(  # type: ignore[name-defined]
        back_populates="reports_filed", foreign_keys=[reporter_id],
    )
    reviewer: Mapped["User | None"] = relationship(foreign_keys=[reviewed_by])  # type: ignore[name-defined]
    assignee: Mapped["User | None"] = relationship(foreign_keys=[assigned_to])  # type: ignore[name-defined]
    appeals: Mapped[list["ReportAppeal"]] = relationship(  # type: ignore[name-defined]
        back_populates="report", lazy="noload",
    )

    def __repr__(self) -> str:
        return f"<Report id={self.id} target={self.target_type.value}:{self.target_id} status={self.status.value}>"


# ── Report Appeal ─────────────────────────────────────────────────────

class ReportAppeal(Base, TimestampMixin):
    """
    An appeal filed by a reported user against a moderation action.
    """

    __tablename__ = "report_appeals"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    report_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("reports.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[AppealStatus] = mapped_column(
        SAEnum(AppealStatus, name="appeal_status", create_constraint=True),
        default=AppealStatus.pending,
    )
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )
    review_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )

    # ── Relationships ─────────────────────────────────────────────────
    report: Mapped["Report"] = relationship(back_populates="appeals")
    user: Mapped["User"] = relationship(foreign_keys=[user_id])  # type: ignore[name-defined]
    reviewer: Mapped["User | None"] = relationship(foreign_keys=[reviewed_by])  # type: ignore[name-defined]

    def __repr__(self) -> str:
        return f"<ReportAppeal id={self.id} report={self.report_id} status={self.status.value}>"


# ── Moderation Audit Log ─────────────────────────────────────────────

class ModerationAuditLog(Base, TimestampMixin):
    """
    Tracks all moderator actions for accountability.
    """

    __tablename__ = "moderation_audit_log"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    moderator_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    target_type: Mapped[str] = mapped_column(String(50), nullable=False)
    target_id: Mapped[str] = mapped_column(String(100), nullable=False)
    details: Mapped[dict | None] = mapped_column(PortableJSON, nullable=True)

    # ── Relationships ─────────────────────────────────────────────────
    moderator: Mapped["User"] = relationship(foreign_keys=[moderator_id])  # type: ignore[name-defined]

    def __repr__(self) -> str:
        return f"<ModerationAuditLog id={self.id} action={self.action} target={self.target_type}:{self.target_id}>"
