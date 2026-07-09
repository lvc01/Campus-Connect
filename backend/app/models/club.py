"""
SQLAlchemy ORM models — Club, ClubMember.

Clubs and societies are central to campus life. Every club requires
moderator approval before going live and can optionally be verified
by the university as an official society.
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, SoftDeleteMixin, TimestampMixin


# ── Enums ─────────────────────────────────────────────────────────────

class ClubMemberRole(str, enum.Enum):
    """Role a user holds within a specific club."""

    member = "member"
    admin = "admin"
    owner = "owner"


class ClubMemberStatus(str, enum.Enum):
    """Status of a club membership request."""

    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class ClubCategory(str, enum.Enum):
    """High-level categories for club discovery and filtering."""

    academic = "academic"
    sports = "sports"
    cultural = "cultural"
    social = "social"
    political = "political"
    religious = "religious"
    tech = "tech"
    other = "other"


# ── Club ──────────────────────────────────────────────────────────────

class Club(Base, TimestampMixin, SoftDeleteMixin):
    """
    A student club or society page.

    Clubs start as unapproved (``is_approved=False``) and require
    moderator review. Verified clubs carry a badge denoting official
    university recognition.
    """

    __tablename__ = "clubs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(200), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[ClubCategory | None] = mapped_column(
        SAEnum(ClubCategory, name="club_category", create_constraint=True),
        nullable=True,
    )
    banner_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    is_approved: Mapped[bool] = mapped_column(Boolean, default=False)
    is_premium: Mapped[bool] = mapped_column(Boolean, default=False)
    requires_approval: Mapped[bool] = mapped_column(Boolean, default=False)
    member_count: Mapped[int] = mapped_column(Integer, default=0)
    created_by: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )

    # ── Relationships ─────────────────────────────────────────────────
    creator: Mapped["User"] = relationship(back_populates="created_clubs")  # type: ignore[name-defined]
    members: Mapped[list["ClubMember"]] = relationship(
        back_populates="club", lazy="noload", cascade="all, delete-orphan",
    )
    posts: Mapped[list["Post"]] = relationship(  # type: ignore[name-defined]
        back_populates="club", lazy="noload",
    )
    events: Mapped[list["Event"]] = relationship(  # type: ignore[name-defined]
        back_populates="club", lazy="noload",
    )

    def __repr__(self) -> str:
        return f"<Club id={self.id} slug={self.slug} approved={self.is_approved}>"


# ── Club Member ───────────────────────────────────────────────────────

class ClubMember(Base, TimestampMixin):
    """
    Junction table between users and clubs.

    Tracks each member's role (member, admin, owner) and join date.
    """

    __tablename__ = "club_members"
    __table_args__ = (
        UniqueConstraint("club_id", "user_id", name="uq_club_member"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    club_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("clubs.id", ondelete="CASCADE"), nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    role: Mapped[ClubMemberRole] = mapped_column(
        SAEnum(ClubMemberRole, name="club_member_role", create_constraint=True),
        default=ClubMemberRole.member,
    )
    status: Mapped[ClubMemberStatus] = mapped_column(
        SAEnum(ClubMemberStatus, name="club_member_status", create_constraint=True),
        default=ClubMemberStatus.approved,
    )
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(),
    )

    # ── Relationships ─────────────────────────────────────────────────
    club: Mapped["Club"] = relationship(back_populates="members")
    user: Mapped["User"] = relationship(back_populates="club_memberships")  # type: ignore[name-defined]

    def __repr__(self) -> str:
        return f"<ClubMember club={self.club_id} user={self.user_id} role={self.role.value}>"
