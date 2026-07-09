import asyncio
import logging
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.club import Club
from app.models.event import Event
from app.models.marketplace import MarketplaceListing
from app.models.post import Post
from app.models.user import Profile, User
from app.services.meilisearch_service import (
    INDEX_USERS,
    INDEX_POSTS,
    INDEX_CLUBS,
    INDEX_EVENTS,
    INDEX_LISTINGS,
    get_meilisearch_client,
)

logger = logging.getLogger(__name__)

GLOBAL_SEARCH_LIMIT = 5


class SearchService:
    async def global_search(
        self,
        q: str,
        db: AsyncSession,
    ) -> dict:
        if not q or len(q.strip()) < 2:
            return {"users": [], "posts": [], "clubs": [], "events": [], "listings": []}

        client = get_meilisearch_client()
        if client is not None:
            return await self._search_meilisearch(q.strip(), client)

        # Fallback to ILIKE-based SQL search
        term = f"%{q.strip()}%"
        users = await self._search_users_sql(term, db)
        posts = await self._search_posts_sql(term, db)
        clubs = await self._search_clubs_sql(term, db)
        events = await self._search_events_sql(term, db)
        listings = await self._search_listings_sql(term, db)

        return {
            "users": users,
            "posts": posts,
            "clubs": clubs,
            "events": events,
            "listings": listings,
        }

    # ── Meilisearch search ──────────────────────────────────────────────

    async def _search_meilisearch(self, q: str, client) -> dict:
        """Search all indexes via Meilisearch.

        The Meilisearch Python client's ``search()`` is a *synchronous*
        blocking call. Running it directly on the event loop would freeze
        every other in-flight request for the duration of the (5) index
        lookups. We offload each call to a thread via ``asyncio.to_thread``
        and run them concurrently.
        """
        limit = GLOBAL_SEARCH_LIMIT

        def _search_index(index_uid: str):
            try:
                results = client.index(index_uid).search(q, limit=limit)
                return results.hits or []
            except Exception as e:
                logger.warning("Meilisearch search failed for %s: %s", index_uid, e)
                return []

        users, posts, clubs, events, listings = await asyncio.gather(
            asyncio.to_thread(_search_index, INDEX_USERS),
            asyncio.to_thread(_search_index, INDEX_POSTS),
            asyncio.to_thread(_search_index, INDEX_CLUBS),
            asyncio.to_thread(_search_index, INDEX_EVENTS),
            asyncio.to_thread(_search_index, INDEX_LISTINGS),
        )

        return {
            "users": [
                {
                    "id": str(u.get("id", "")),
                    "email": u.get("email", ""),
                    "display_name": u.get("display_name", ""),
                    "faculty": u.get("faculty"),
                    "year_of_study": u.get("year_of_study"),
                }
                for u in users
            ],
            "posts": [
                {
                    "id": str(p.get("id", "")),
                    "content": (p.get("content") or "")[:200],
                    "author_name": p.get("author_name", "Unknown"),
                    "author_id": str(p.get("author_id", "")),
                    "created_at": p.get("created_at", ""),
                    "like_count": p.get("like_count", 0),
                }
                for p in posts
            ],
            "clubs": [
                {
                    "id": str(c.get("id", "")),
                    "slug": c.get("slug", ""),
                    "name": c.get("name", ""),
                    "description": (c.get("description") or "")[:200],
                    "member_count": c.get("member_count", 0),
                    "is_premium": c.get("is_premium", False),
                }
                for c in clubs
            ],
            "events": [
                {
                    "id": str(e.get("id", "")),
                    "title": e.get("title", ""),
                    "start_time": e.get("start_time", ""),
                    "location": e.get("location"),
                    "status": e.get("status", ""),
                }
                for e in events
            ],
            "listings": [
                {
                    "id": str(l.get("id", "")),
                    "title": l.get("title", ""),
                    "price": l.get("price", 0),
                    "category": l.get("category", ""),
                }
                for l in listings
            ],
        }

    # ── SQL fallback search (ILIKE) ────────────────────────────────────

    async def _search_users_sql(self, term: str, db: AsyncSession) -> list[dict]:
        result = await db.execute(
            select(User)
            .options(selectinload(User.profile))
            .where(
                User.deleted_at.is_(None),
                or_(
                    User.email.ilike(term),
                    Profile.display_name.ilike(term),
                ),
            )
            .join(Profile, User.id == Profile.user_id)
            .limit(GLOBAL_SEARCH_LIMIT)
        )
        users = result.scalars().unique().all()
        return [
            {
                "id": str(u.id),
                "email": u.email,
                "display_name": u.profile.display_name if u.profile else u.email.split("@")[0],
                "faculty": u.profile.faculty if u.profile else None,
                "year_of_study": u.profile.year_of_study if u.profile else None,
            }
            for u in users
        ]

    async def _search_posts_sql(self, term: str, db: AsyncSession) -> list[dict]:
        result = await db.execute(
            select(Post)
            .options(selectinload(Post.author).selectinload(User.profile))
            .where(
                Post.deleted_at.is_(None),
                Post.content.ilike(term),
            )
            .order_by(Post.created_at.desc())
            .limit(GLOBAL_SEARCH_LIMIT)
        )
        posts = result.scalars().unique().all()
        return [
            {
                "id": str(p.id),
                "content": p.content[:200] if p.content else None,
                "author_name": p.author.profile.display_name if p.author.profile else "Unknown",
                "author_id": str(p.author.id),
                "created_at": p.created_at.isoformat(),
                "like_count": p.like_count,
            }
            for p in posts
        ]

    async def _search_clubs_sql(self, term: str, db: AsyncSession) -> list[dict]:
        result = await db.execute(
            select(Club)
            .where(
                Club.is_approved == True,
                Club.deleted_at.is_(None),
                or_(
                    Club.name.ilike(term),
                    Club.description.ilike(term),
                ),
            )
            .limit(GLOBAL_SEARCH_LIMIT)
        )
        clubs = result.scalars().all()
        return [
            {
                "id": str(c.id),
                "slug": c.slug,
                "name": c.name,
                "description": c.description[:200] if c.description else None,
                "member_count": c.member_count,
                "is_premium": c.is_premium,
            }
            for c in clubs
        ]

    async def _search_events_sql(self, term: str, db: AsyncSession) -> list[dict]:
        result = await db.execute(
            select(Event)
            .where(
                Event.deleted_at.is_(None),
                or_(
                    Event.title.ilike(term),
                    Event.description.ilike(term),
                ),
            )
            .order_by(Event.start_time.desc())
            .limit(GLOBAL_SEARCH_LIMIT)
        )
        events = result.scalars().all()
        return [
            {
                "id": str(e.id),
                "title": e.title,
                "start_time": e.start_time.isoformat() if e.start_time else None,
                "location": e.location,
                "status": e.status.value,
            }
            for e in events
        ]

    async def _search_listings_sql(self, term: str, db: AsyncSession) -> list[dict]:
        result = await db.execute(
            select(MarketplaceListing)
            .where(
                MarketplaceListing.deleted_at.is_(None),
                MarketplaceListing.status == "active",
                MarketplaceListing.title.ilike(term),
            )
            .order_by(MarketplaceListing.created_at.desc())
            .limit(GLOBAL_SEARCH_LIMIT)
        )
        listings = result.scalars().all()
        return [
            {
                "id": str(l.id),
                "title": l.title,
                "price": float(l.price) if l.price else 0,
                "category": l.category.value,
            }
            for l in listings
        ]


def get_search_service() -> SearchService:
    return SearchService()
