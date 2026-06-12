"""
User service — CRUD operations on user and profile records.

Provides the data-access methods used by API routes, keeping
route handlers thin and testable.
"""

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import NotFoundException
from app.models.club import ClubMember
from app.models.event import Event
from app.models.marketplace import MarketplaceListing
from app.models.post import Post
from app.models.user import Profile, User
from app.schemas.user import UpdateProfileRequest


class UserService:
    """Data-access layer for user and profile operations."""

    async def get_user_by_id(
        self,
        user_id: uuid.UUID,
        db: AsyncSession,
    ) -> User:
        """
        Fetch a user by ID with their profile.

        Args:
            user_id: UUID of the user.
            db: Async database session.

        Returns:
            The User ORM instance.

        Raises:
            NotFoundException: If no active user exists with this ID.
        """
        result = await db.execute(
            select(User)
            .options(selectinload(User.profile))
            .where(User.id == user_id, User.deleted_at.is_(None))
        )
        user = result.scalar_one_or_none()
        if user is None:
            raise NotFoundException(detail="User not found.")
        return user

    async def get_user_profile_with_stats(
        self,
        user_id: uuid.UUID,
        db: AsyncSession,
    ) -> dict:
        user = await self.get_user_by_id(user_id, db)

        posts_count = await db.execute(
            select(func.count(Post.id)).where(Post.author_id == user_id, Post.deleted_at.is_(None))
        )
        clubs_count = await db.execute(
            select(func.count(ClubMember.id)).where(ClubMember.user_id == user_id)
        )
        listings_count = await db.execute(
            select(func.count(MarketplaceListing.id)).where(MarketplaceListing.seller_id == user_id)
        )
        events_count = await db.execute(
            select(func.count(Event.id)).where(Event.organizer_id == user_id)
        )

        return {
            "user": user,
            "posts_count": posts_count.scalar() or 0,
            "clubs_count": clubs_count.scalar() or 0,
            "listings_count": listings_count.scalar() or 0,
            "events_count": events_count.scalar() or 0,
        }

    async def get_user_by_email(
        self,
        email: str,
        db: AsyncSession,
    ) -> User | None:
        """
        Fetch a user by email (case-insensitive).

        Returns:
            The User ORM instance or ``None``.
        """
        result = await db.execute(
            select(User)
            .options(selectinload(User.profile))
            .where(User.email == email.lower(), User.deleted_at.is_(None))
        )
        return result.scalar_one_or_none()

    async def update_profile(
        self,
        user_id: uuid.UUID,
        data: UpdateProfileRequest,
        db: AsyncSession,
    ) -> Profile:
        """
        Partially update the user's profile with the provided fields.

        Only non-None fields in ``data`` are applied, so the client
        can send a sparse update without clobbering existing values.

        Args:
            user_id: UUID of the user whose profile to update.
            data: Partial profile update payload.
            db: Async database session.

        Returns:
            The updated Profile ORM instance.

        Raises:
            NotFoundException: If the profile does not exist.
        """
        result = await db.execute(
            select(Profile).where(Profile.user_id == user_id)
        )
        profile = result.scalar_one_or_none()
        if profile is None:
            raise NotFoundException(detail="Profile not found.")

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(profile, field, value)

        await db.flush()
        await db.refresh(profile)
        return profile


def get_user_service() -> UserService:
    """Return a UserService instance."""
    return UserService()
