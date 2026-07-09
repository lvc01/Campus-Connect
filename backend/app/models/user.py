"""
SQLAlchemy ORM models — User, Profile, OTPCode, RefreshToken.

This module defines the core identity tables that underpin authentication,
authorization, and user profiles across the entire platform.
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum as SAEnum, ForeignKey, Integer, String, Text, func
from app.core.types import PortableJSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, SoftDeleteMixin, TimestampMixin


# ── Enums ─────────────────────────────────────────────────────────────

class UserRole(str, enum.Enum):
    """Roles that govern platform-wide permissions."""

    student = "student"
    club_admin = "club_admin"
    moderator = "moderator"
    university_staff = "university_staff"
    admin = "admin"


class OTPPurpose(str, enum.Enum):
    """Reasons an OTP may be generated."""

    email_verification = "email_verification"
    password_reset = "password_reset"


# ── User ──────────────────────────────────────────────────────────────

class User(Base, TimestampMixin, SoftDeleteMixin):
    """
    Core identity record for every registered student / staff member.

    A user must verify their university email before they can log in.
    Soft-deletes are used — ``deleted_at`` is set instead of removing rows.
    """

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    username: Mapped[str | None] = mapped_column(
        String(50), unique=True, nullable=True, index=True
    )
    hashed_password: Mapped[str] = mapped_column(
        String(255), nullable=False
    )
    role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole, name="user_role", create_constraint=True),
        default=UserRole.student,
        nullable=False,
    )
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    failed_login_attempts: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, default=None)
    total_upload_bytes: Mapped[int] = mapped_column(Integer, default=0)

    # ── Relationships ─────────────────────────────────────────────────
    profile: Mapped["Profile"] = relationship(
        back_populates="user", uselist=False, lazy="selectin",
    )
    otp_codes: Mapped[list["OTPCode"]] = relationship(
        back_populates="user", lazy="selectin",
    )
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(
        back_populates="user", lazy="noload",
    )
    posts: Mapped[list["Post"]] = relationship(  # type: ignore[name-defined]
        back_populates="author", lazy="noload",
    )
    comments: Mapped[list["Comment"]] = relationship(  # type: ignore[name-defined]
        back_populates="author", lazy="noload",
    )
    likes: Mapped[list["Like"]] = relationship(  # type: ignore[name-defined]
        back_populates="user", lazy="noload",
    )
    saves: Mapped[list["Save"]] = relationship(  # type: ignore[name-defined]
        back_populates="user", lazy="noload",
    )
    shares: Mapped[list["Share"]] = relationship(  # type: ignore[name-defined]
        back_populates="user", lazy="noload",
    )
    listing_saves: Mapped[list["ListingSave"]] = relationship(  # type: ignore[name-defined]
        back_populates="user", lazy="noload",
    )
    created_clubs: Mapped[list["Club"]] = relationship(  # type: ignore[name-defined]
        back_populates="creator", lazy="noload",
    )
    club_memberships: Mapped[list["ClubMember"]] = relationship(  # type: ignore[name-defined]
        back_populates="user", lazy="noload",
    )
    organized_events: Mapped[list["Event"]] = relationship(  # type: ignore[name-defined]
        back_populates="organizer", lazy="noload",
    )
    rsvps: Mapped[list["RSVP"]] = relationship(  # type: ignore[name-defined]
        back_populates="user", lazy="noload",
    )
    event_saves: Mapped[list["EventSave"]] = relationship(  # type: ignore[name-defined]
        back_populates="user", lazy="noload",
    )
    poll_votes: Mapped[list["PollVote"]] = relationship(  # type: ignore[name-defined]
        back_populates="user", lazy="noload",
    )
    uploaded_resources: Mapped[list["Resource"]] = relationship(  # type: ignore[name-defined]
        back_populates="uploader", lazy="noload",
    )
    marketplace_listings: Mapped[list["MarketplaceListing"]] = relationship(  # type: ignore[name-defined]
        back_populates="seller", lazy="noload",
    )
    sent_messages: Mapped[list["Message"]] = relationship(  # type: ignore[name-defined]
        back_populates="sender", lazy="noload",
    )
    notifications: Mapped[list["Notification"]] = relationship(  # type: ignore[name-defined]
        back_populates="user", lazy="noload", foreign_keys="Notification.user_id",
    )
    reports_filed: Mapped[list["Report"]] = relationship(  # type: ignore[name-defined]
        back_populates="reporter", lazy="noload", foreign_keys="Report.reporter_id",
    )
    seller_ratings_given: Mapped[list["SellerRating"]] = relationship(  # type: ignore[name-defined]
        back_populates="buyer", lazy="noload", foreign_keys="SellerRating.buyer_id",
    )
    seller_ratings_received: Mapped[list["SellerRating"]] = relationship(  # type: ignore[name-defined]
        back_populates="seller", lazy="noload", foreign_keys="SellerRating.seller_id",
    )
    conversation_memberships: Mapped[list["ConversationMember"]] = relationship(  # type: ignore[name-defined]
        back_populates="user", lazy="noload",
    )
    push_tokens: Mapped[list["UserPushToken"]] = relationship(
        back_populates="user", lazy="noload",
    )
    settings: Mapped["UserSettings"] = relationship(
        back_populates="user", uselist=False, lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email} role={self.role.value}>"


# ── Profile ───────────────────────────────────────────────────────────

class Profile(Base, TimestampMixin):
    """
    Extended student profile (1-to-1 with User).

    Stores display information, faculty/year, and social links
    as a JSONB blob for flexible schema.
    """

    __tablename__ = "profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False,
    )
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    faculty: Mapped[str | None] = mapped_column(String(100), nullable=True)
    year_of_study: Mapped[int | None] = mapped_column(Integer, nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    cover_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    social_links: Mapped[dict | None] = mapped_column(
        PortableJSON, nullable=True, server_default="{}"
    )

    # ── Relationships ─────────────────────────────────────────────────
    user: Mapped["User"] = relationship(back_populates="profile")

    def __repr__(self) -> str:
        return f"<Profile id={self.id} display_name={self.display_name}>"


# ── User Settings ──────────────────────────────────────────────────────

class UserSettings(Base, TimestampMixin):
    """
    Per-user notification and privacy preferences.
    """

    __tablename__ = "user_settings"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False,
    )

    # Notification preferences
    push_notifications: Mapped[bool] = mapped_column(Boolean, default=True)
    email_notifications: Mapped[bool] = mapped_column(Boolean, default=False)
    like_notifications: Mapped[bool] = mapped_column(Boolean, default=True)
    comment_notifications: Mapped[bool] = mapped_column(Boolean, default=True)
    mention_notifications: Mapped[bool] = mapped_column(Boolean, default=True)
    follow_notifications: Mapped[bool] = mapped_column(Boolean, default=True)
    event_notifications: Mapped[bool] = mapped_column(Boolean, default=True)

    # Privacy preferences
    public_profile: Mapped[bool] = mapped_column(Boolean, default=True)
    show_online_status: Mapped[bool] = mapped_column(Boolean, default=True)
    show_read_receipts: Mapped[bool] = mapped_column(Boolean, default=True)

    # ── Relationships ─────────────────────────────────────────────────
    user: Mapped["User"] = relationship(back_populates="settings")

    def __repr__(self) -> str:
        return f"<UserSettings user={self.user_id}>"


# ── OTP Code ──────────────────────────────────────────────────────────

class OTPCode(Base, TimestampMixin):
    """
    One-time password for email verification or password reset.

    Each OTP expires after ``OTP_EXPIRE_MINUTES`` and tracks the number
    of validation attempts to prevent brute-forcing.
    """

    __tablename__ = "otp_codes"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    purpose: Mapped[OTPPurpose] = mapped_column(
        SAEnum(OTPPurpose, name="otp_purpose", create_constraint=True),
        nullable=False,
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
    )
    is_used: Mapped[bool] = mapped_column(Boolean, default=False)
    attempts: Mapped[int] = mapped_column(Integer, default=0)

    # ── Relationships ─────────────────────────────────────────────────
    user: Mapped["User"] = relationship(back_populates="otp_codes")

    def __repr__(self) -> str:
        return f"<OTPCode id={self.id} purpose={self.purpose.value} used={self.is_used}>"


# ── Refresh Token ─────────────────────────────────────────────────────

class RefreshToken(Base, TimestampMixin):
    """
    Hashed refresh tokens stored server-side for token rotation.

    When a refresh token is used, the old one is revoked and a new
    pair (access + refresh) is issued — preventing replay attacks.
    """

    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    token_hash: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False,
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
    )
    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False)

    # ── Relationships ─────────────────────────────────────────────────
    user: Mapped["User"] = relationship(back_populates="refresh_tokens")

    def __repr__(self) -> str:
        return f"<RefreshToken id={self.id} revoked={self.is_revoked}>"


# ── Push Token ────────────────────────────────────────────────────────

class UserPushToken(Base, TimestampMixin):
    """
    Expo push tokens for sending push notifications to mobile devices.

    Each device registers its push token with the server, which is used
    to send push notifications via Expo Push API.
    """

    __tablename__ = "user_push_tokens"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    token: Mapped[str] = mapped_column(
        String(500), unique=True, nullable=False,
    )
    platform: Mapped[str] = mapped_column(
        String(20), nullable=False, default="ios",
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # ── Relationships ─────────────────────────────────────────────────
    user: Mapped["User"] = relationship(back_populates="push_tokens")

    def __repr__(self) -> str:
        return f"<UserPushToken id={self.id} platform={self.platform}>"
