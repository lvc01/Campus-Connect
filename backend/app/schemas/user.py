"""
Pydantic schemas for user profiles.

Separates the read (response) and write (request) shapes so that
sensitive fields like ``hashed_password`` never leak to the client.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ProfileResponse(BaseModel):
    """Public profile information returned in API responses."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    display_name: str
    faculty: str | None = None
    year_of_study: int | None = None
    bio: str | None = None
    avatar_url: str | None = None
    cover_url: str | None = None
    social_links: dict | None = None
    created_at: datetime


class UserResponse(BaseModel):
    """User record returned in API responses (includes nested profile)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    username: str | None = None
    role: str
    is_verified: bool
    profile: ProfileResponse | None = None
    created_at: datetime


class PublicProfileResponse(UserResponse):
    """User profile with public stats for profile page display."""

    posts_count: int = 0
    clubs_count: int = 0
    listings_count: int = 0
    events_count: int = 0


class UpdateProfileRequest(BaseModel):
    """Partial update payload for the current user's profile."""

    # Same character restrictions as registration: no control chars or
    # zero-width / bidi overrides that enable spoofing or stored XSS.
    display_name: str | None = Field(
        default=None,
        min_length=2,
        max_length=100,
        pattern=r"^[^\u0000-\u001F\u007F\u200B-\u200F\u2028-\u202F]+$",
    )
    faculty: str | None = Field(default=None, max_length=100)
    year_of_study: int | None = Field(default=None, ge=1, le=7)
    bio: str | None = Field(default=None, max_length=500)
    avatar_url: str | None = Field(default=None, max_length=500)
    cover_url: str | None = Field(default=None, max_length=500)
    # Bound the social_links blob: at most 10 entries, each value ≤ 500 chars.
    # Without this a user could store megabytes of arbitrary JSON (a stored-XSS
    # vector if the frontend ever renders it as HTML).
    social_links: dict | None = Field(default=None, max_length=2000)

    @field_validator("social_links")
    @classmethod
    def validate_social_links(cls, v: dict | None) -> dict | None:
        if v is None:
            return v
        if len(v) > 10:
            raise ValueError("social_links may contain at most 10 entries.")
        for key, val in v.items():
            if not isinstance(key, str) or len(key) > 50:
                raise ValueError("social_links keys must be strings of ≤ 50 characters.")
            if not isinstance(val, str) or len(val) > 500:
                raise ValueError("social_links values must be strings of ≤ 500 characters.")
        return v


# ── User Settings Schemas ──────────────────────────────────────────────

class UserSettingsResponse(BaseModel):
    """User notification and privacy settings."""

    model_config = ConfigDict(from_attributes=True)

    # Notifications
    push_notifications: bool = True
    email_notifications: bool = False
    like_notifications: bool = True
    comment_notifications: bool = True
    mention_notifications: bool = True
    follow_notifications: bool = True
    event_notifications: bool = True

    # Privacy
    public_profile: bool = True
    show_online_status: bool = True
    show_read_receipts: bool = True


class UpdateUserSettingsRequest(BaseModel):
    """Partial update for user settings."""

    push_notifications: bool | None = None
    email_notifications: bool | None = None
    like_notifications: bool | None = None
    comment_notifications: bool | None = None
    mention_notifications: bool | None = None
    follow_notifications: bool | None = None
    event_notifications: bool | None = None
    public_profile: bool | None = None
    show_online_status: bool | None = None
    show_read_receipts: bool | None = None


class ChangePasswordRequest(BaseModel):
    """Change password request."""

    current_password: str = Field(min_length=8, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class UpdateUsernameRequest(BaseModel):
    """Update username request."""

    username: str = Field(min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9._]+$")
