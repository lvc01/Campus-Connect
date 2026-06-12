"""
Pydantic schemas for user profiles.

Separates the read (response) and write (request) shapes so that
sensitive fields like ``hashed_password`` never leak to the client.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


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

    display_name: str | None = Field(default=None, min_length=2, max_length=100)
    faculty: str | None = None
    year_of_study: int | None = Field(default=None, ge=1, le=7)
    bio: str | None = Field(default=None, max_length=500)
    avatar_url: str | None = Field(default=None, max_length=500)
    cover_url: str | None = Field(default=None, max_length=500)
    social_links: dict | None = None
