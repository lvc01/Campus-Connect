"""
User profile API endpoints.

Provides profile read and update operations for the current user
and public profile lookup for any user by ID.
"""

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.post import FeedResponse, CommentListResponse
from app.schemas.user import (
    ChangePasswordRequest,
    ProfileResponse,
    PublicProfileResponse,
    UpdateProfileRequest,
    UpdateUserSettingsRequest,
    UpdateUsernameRequest,
    UserResponse,
    UserSettingsResponse,
)
from app.services.post_service import get_post_service
from app.services.user_service import get_user_service

router = APIRouter(prefix="/users", tags=["Users"])


@router.get(
    "/me/profile",
    response_model=ProfileResponse,
    summary="Get my profile",
)
async def get_my_profile(
    current_user: User = Depends(get_current_user),
) -> ProfileResponse:
    """Return the profile of the currently authenticated user."""
    return ProfileResponse.model_validate(current_user.profile)


@router.patch(
    "/me/profile",
    response_model=ProfileResponse,
    summary="Update my profile",
)
async def update_my_profile(
    data: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProfileResponse:
    """
    Partially update the current user's profile.

    Only the fields included in the request body will be updated.
    """
    user_service = get_user_service()
    profile = await user_service.update_profile(current_user.id, data, db)
    return ProfileResponse.model_validate(profile)


@router.get(
    "/{user_id}",
    response_model=UserResponse,
    summary="Get user by ID",
)
async def get_user(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
  """Return the public profile of a user by their ID."""
  user_service = get_user_service()
  user = await user_service.get_user_by_id(user_id, db)
  return UserResponse.model_validate(user)


@router.get(
    "/{user_id}/profile",
    response_model=PublicProfileResponse,
    summary="Get public profile with stats",
)
async def get_public_profile(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PublicProfileResponse:
  """Return a user's public profile with activity stats."""
  user_service = get_user_service()
  data = await user_service.get_user_profile_with_stats(user_id, db)
  resp = PublicProfileResponse.model_validate(data["user"])
  resp.posts_count = data["posts_count"]
  resp.clubs_count = data["clubs_count"]
  resp.listings_count = data["listings_count"]
  resp.events_count = data["events_count"]
  return resp


@router.get(
    "/me/saves",
    response_model=FeedResponse,
    summary="Get my saved posts",
)
async def get_saved_posts(
    cursor: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FeedResponse:
  """Return paginated bookmarked posts for the current user."""
  post_service = get_post_service()
  result = await post_service.get_saved_posts(current_user.id, cursor, limit, db)
  return FeedResponse.model_validate(result)


@router.get(
    "/{user_id}/likes",
    response_model=FeedResponse,
    summary="Get posts liked by a user",
)
async def get_user_likes(
    user_id: uuid.UUID,
    cursor: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FeedResponse:
  """Return paginated posts liked by a specific user."""
  post_service = get_post_service()
  result = await post_service.get_liked_posts(user_id, cursor, limit, db)
  return FeedResponse.model_validate(result)


@router.get(
    "/{user_id}/replies",
    response_model=CommentListResponse,
    summary="Get comments/replies by a user",
)
async def get_user_replies(
    user_id: uuid.UUID,
    cursor: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CommentListResponse:
  """Return paginated comments authored by a specific user."""
  post_service = get_post_service()
  result = await post_service.get_user_comments(user_id, cursor, limit, db)
  return CommentListResponse.model_validate(result)


@router.get(
    "/{user_id}/media",
    response_model=FeedResponse,
    summary="Get media posts by a user",
)
async def get_user_media(
    user_id: uuid.UUID,
    cursor: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FeedResponse:
  """Return paginated posts with media attachments by a specific user."""
  post_service = get_post_service()
  result = await post_service.get_user_media_posts(user_id, cursor, limit, db)
  return FeedResponse.model_validate(result)


@router.get(
    "/{user_id}/reposts",
    response_model=FeedResponse,
    summary="Get reposted posts by a user",
)
async def get_user_reposts(
    user_id: uuid.UUID,
    cursor: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FeedResponse:
  """Return paginated posts shared/reposted by a specific user."""
  post_service = get_post_service()
  result = await post_service.get_user_reposts(user_id, cursor, limit, db)
  return FeedResponse.model_validate(result)


# ── User Settings Endpoints ────────────────────────────────────────────

@router.get(
    "/me/settings",
    response_model=UserSettingsResponse,
    summary="Get user settings",
)
async def get_user_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserSettingsResponse:
    """Get the current user's notification and privacy settings."""
    from app.models.user import UserSettings
    from sqlalchemy import select

    result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == current_user.id)
    )
    settings = result.scalar_one_or_none()

    if not settings:
        settings = UserSettings(user_id=current_user.id)
        db.add(settings)
        await db.flush()

    return UserSettingsResponse.model_validate(settings)


@router.patch(
    "/me/settings",
    response_model=UserSettingsResponse,
    summary="Update user settings",
)
async def update_user_settings(
    data: UpdateUserSettingsRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserSettingsResponse:
    """Update the current user's notification and privacy settings."""
    from app.models.user import UserSettings
    from sqlalchemy import select

    result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == current_user.id)
    )
    settings = result.scalar_one_or_none()

    if not settings:
        settings = UserSettings(user_id=current_user.id)
        db.add(settings)
        await db.flush()

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(settings, field, value)

    await db.commit()
    await db.refresh(settings)

    return UserSettingsResponse.model_validate(settings)


@router.post(
    "/me/change-password",
    summary="Change password",
)
async def change_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Change the current user's password."""
    from app.core.security import verify_password, hash_password

    if not verify_password(data.current_password, current_user.hashed_password):
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    current_user.hashed_password = hash_password(data.new_password)
    await db.commit()

    return {"message": "Password changed successfully"}


@router.patch(
    "/me/username",
    response_model=UserResponse,
    summary="Update username",
)
async def update_username(
    data: UpdateUsernameRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """Update the current user's username."""
    from fastapi import HTTPException
    from sqlalchemy import select

    # Check if username is already taken
    existing = await db.execute(
        select(User).where(User.username == data.username, User.id != current_user.id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username is already taken")

    current_user.username = data.username
    await db.commit()
    await db.refresh(current_user)

    return UserResponse.model_validate(current_user)


@router.delete(
    "/me",
    summary="Delete account",
)
async def delete_account(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete the current user's account."""
    from datetime import datetime, timezone

    current_user.deleted_at = datetime.now(timezone.utc)
    current_user.is_active = False
    await db.commit()

    return {"message": "Account deleted successfully"}
