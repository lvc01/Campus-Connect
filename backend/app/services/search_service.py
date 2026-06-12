from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.club import Club
from app.models.event import Event
from app.models.marketplace import MarketplaceListing
from app.models.post import Post
from app.models.user import Profile, User


GLOBAL_SEARCH_LIMIT = 5


class SearchService:
    async def global_search(
        self,
        q: str,
        db: AsyncSession,
    ) -> dict:
        if not q or len(q.strip()) < 2:
            return {"users": [], "posts": [], "clubs": [], "events": [], "listings": []}

        term = f"%{q.strip()}%"

        users = await self._search_users(term, db)
        posts = await self._search_posts(term, db)
        clubs = await self._search_clubs(term, db)
        events = await self._search_events(term, db)
        listings = await self._search_listings(term, db)

        return {
            "users": users,
            "posts": posts,
            "clubs": clubs,
            "events": events,
            "listings": listings,
        }

    async def _search_users(self, term: str, db: AsyncSession) -> list[dict]:
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

    async def _search_posts(self, term: str, db: AsyncSession) -> list[dict]:
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

    async def _search_clubs(self, term: str, db: AsyncSession) -> list[dict]:
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

    async def _search_events(self, term: str, db: AsyncSession) -> list[dict]:
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

    async def _search_listings(self, term: str, db: AsyncSession) -> list[dict]:
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
