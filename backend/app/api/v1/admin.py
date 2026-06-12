import uuid
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User, UserRole
from app.models.post import Post
from app.models.club import Club
from app.models.event import Event
from app.models.marketplace import MarketplaceListing
from app.models.messaging import Message

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/stats")
async def get_admin_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in (UserRole.admin, UserRole.university_staff):
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Admin access required")

    users_count = (await db.execute(select(func.count(User.id)))).scalar() or 0
    posts_count = (await db.execute(select(func.count(Post.id)))).scalar() or 0
    clubs_count = (await db.execute(select(func.count(Club.id)))).scalar() or 0
    events_count = (await db.execute(select(func.count(Event.id)))).scalar() or 0
    listings_count = (await db.execute(select(func.count(MarketplaceListing.id)))).scalar() or 0
    messages_count = (await db.execute(select(func.count(Message.id)))).scalar() or 0

    return {
        "users": users_count,
        "posts": posts_count,
        "clubs": clubs_count,
        "events": events_count,
        "listings": listings_count,
        "messages": messages_count,
    }
