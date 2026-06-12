"""
SQLAlchemy ORM models — Event, RSVP.

Events can be club-hosted or independently organized. They support
RSVP limits, attendance tracking, and link to the campus calendar.
"""

import enum
import uuid

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, SoftDeleteMixin, TimestampMixin


# ── Enums ─────────────────────────────────────────────────────────────

class RSVPStatus(str, enum.Enum):
    """RSVP response options for an event."""

    going = "going"
    maybe = "maybe"
    not_going = "not_going"


class EventStatus(str, enum.Enum):
    """Lifecycle status of an event."""

    upcoming = "upcoming"
    ongoing = "ongoing"
    completed = "completed"
    cancelled = "cancelled"


# ── Event ─────────────────────────────────────────────────────────────

class Event(Base, TimestampMixin, SoftDeleteMixin):
    """
    A campus event with optional RSVP limit and club association.

    Events appear on the unified campus calendar and can trigger
    reminder notifications before they begin.
    """

    __tablename__ = "events"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    start_time: Mapped[str] = mapped_column(
        DateTime(timezone=True), nullable=False,
    )
    end_time: Mapped[str | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    location: Mapped[str | None] = mapped_column(String(300), nullable=True)
    cover_image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    rsvp_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rsvp_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[EventStatus] = mapped_column(
        SAEnum(EventStatus, name="event_status", create_constraint=True),
        default=EventStatus.upcoming,
    )
    organizer_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )
    club_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("clubs.id", ondelete="SET NULL"), nullable=True,
    )

    # ── Relationships ─────────────────────────────────────────────────
    organizer: Mapped["User"] = relationship(back_populates="organized_events")  # type: ignore[name-defined]
    club: Mapped["Club | None"] = relationship(back_populates="events")  # type: ignore[name-defined]
    rsvps: Mapped[list["RSVP"]] = relationship(
        back_populates="event", lazy="noload", cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Event id={self.id} title={self.title!r}>"


# ── RSVP ──────────────────────────────────────────────────────────────

class RSVP(Base, TimestampMixin):
    """
    A user's RSVP response to an event.

    The ``attended`` flag can be set after the event for analytics.
    """

    __tablename__ = "rsvps"
    __table_args__ = (
        UniqueConstraint("event_id", "user_id", name="uq_rsvp_event_user"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"), nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )
    status: Mapped[RSVPStatus] = mapped_column(
        SAEnum(RSVPStatus, name="rsvp_status", create_constraint=True),
        default=RSVPStatus.going,
    )
    attended: Mapped[bool] = mapped_column(Boolean, default=False)

    # ── Relationships ─────────────────────────────────────────────────
    event: Mapped["Event"] = relationship(back_populates="rsvps")
    user: Mapped["User"] = relationship(back_populates="rsvps")  # type: ignore[name-defined]

    def __repr__(self) -> str:
        return f"<RSVP event={self.event_id} user={self.user_id} status={self.status.value}>"
