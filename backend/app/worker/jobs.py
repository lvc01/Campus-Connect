"""
ARQ background job definitions.

Each async function here is a job that can be enqueued via the Redis queue.
Jobs are executed by the ARQ worker process (separate from the API workers).
"""

import logging
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.services.email_service import EmailService

logger = logging.getLogger(__name__)


async def send_otp_email_job(
    ctx: dict,
    to: str,
    otp: str,
    purpose: str,
) -> None:
    """Background job: send an OTP email via SMTP (or console)."""
    logger.info("ARQ job: sending OTP email to %s for %s", to, purpose)
    service = EmailService()
    try:
        await service.send_otp_email(to=to, otp=otp, purpose=purpose)
        logger.info("ARQ job: OTP email sent to %s", to)
    except Exception as e:
        logger.error("ARQ job: failed to send OTP email to %s: %s", to, e)
        raise  # ARQ will retry


async def send_notification_job(
    ctx: dict,
    user_id: str,
    title: str,
    body: str,
    url: str | None = None,
) -> None:
    """Background job: send a push notification to a user's devices.

    Delegates to the Expo push service. Best-effort — failures are logged
    inside the service and never re-raised so the in-app notification (which
    is written synchronously) is unaffected by push delivery problems.
    """
    from app.services.push_service import send_push_notification

    logger.info("ARQ job: push notification to user %s: %s", user_id, title)
    data = {"url": url} if url else None
    await send_push_notification(user_id, title=title, body=body, data=data)
    logger.info("ARQ job: push dispatched to %s", user_id)


async def reindex_meilisearch(ctx: dict) -> None:
    """Background job: rebuild all Meilisearch indexes from the database.

    Run this after schema changes, data migrations, or when Meilisearch
    data is stale.
    """
    from app.services.meilisearch_service import (
        get_meilisearch_client,
        ensure_indexes,
        INDEX_USERS,
        INDEX_POSTS,
        INDEX_CLUBS,
        INDEX_EVENTS,
        INDEX_LISTINGS,
    )
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from app.models.user import User, Profile
    from app.models.post import Post
    from app.models.club import Club
    from app.models.event import Event
    from app.models.marketplace import MarketplaceListing

    client = get_meilisearch_client()
    if client is None:
        logger.warning("Meilisearch unavailable — skipping reindex")
        return

    ensure_indexes(client)

    async with AsyncSessionLocal() as db:
        # Index users
        result = await db.execute(
            select(User)
            .options(selectinload(User.profile))
            .where(User.deleted_at.is_(None))
        )
        users = result.scalars().unique().all()
        client.index(INDEX_USERS).add_documents([
            {
                "id": str(u.id),
                "email": u.email,
                "display_name": u.profile.display_name if u.profile else u.email.split("@")[0],
                "faculty": u.profile.faculty if u.profile else None,
                "year_of_study": u.profile.year_of_study if u.profile else None,
                "role": u.role.value if hasattr(u.role, "value") else u.role,
            }
            for u in users
        ])
        logger.info("Reindexed %d users", len(users))

        # Index posts
        result = await db.execute(
            select(Post)
            .options(selectinload(Post.author).selectinload(User.profile))
            .where(Post.deleted_at.is_(None))
        )
        posts = result.scalars().unique().all()
        client.index(INDEX_POSTS).add_documents([
            {
                "id": str(p.id),
                "content": p.content or "",
                "author_name": p.author.profile.display_name if p.author and p.author.profile else "Unknown",
                "author_id": str(p.author.id) if p.author else "",
                "created_at": p.created_at.isoformat() if p.created_at else "",
                "like_count": p.like_count or 0,
            }
            for p in posts
        ])
        logger.info("Reindexed %d posts", len(posts))

        # Index clubs
        result = await db.execute(
            select(Club).where(Club.deleted_at.is_(None), Club.is_approved == True)
        )
        clubs = result.scalars().all()
        client.index(INDEX_CLUBS).add_documents([
            {
                "id": str(c.id),
                "slug": c.slug,
                "name": c.name,
                "description": c.description or "",
                "member_count": c.member_count or 0,
                "is_premium": c.is_premium or False,
            }
            for c in clubs
        ])
        logger.info("Reindexed %d clubs", len(clubs))

        # Index events
        result = await db.execute(
            select(Event).where(Event.deleted_at.is_(None))
        )
        events = result.scalars().all()
        client.index(INDEX_EVENTS).add_documents([
            {
                "id": str(e.id),
                "title": e.title,
                "description": e.description or "",
                "location": e.location or "",
                "start_time": e.start_time.isoformat() if e.start_time else "",
                "status": e.status.value if e.status else "",
            }
            for e in events
        ])
        logger.info("Reindexed %d events", len(events))

        # Index listings
        result = await db.execute(
            select(MarketplaceListing).where(
                MarketplaceListing.deleted_at.is_(None),
                MarketplaceListing.status == "active",
            )
        )
        listings = result.scalars().all()
        client.index(INDEX_LISTINGS).add_documents([
            {
                "id": str(l.id),
                "title": l.title,
                "description": l.description or "",
                "price": float(l.price) if l.price else 0,
                "category": l.category.value if l.category else "",
                "status": l.status,
            }
            for l in listings
        ])
        logger.info("Reindexed %d listings", len(listings))

    logger.info("Meilisearch reindex complete")
