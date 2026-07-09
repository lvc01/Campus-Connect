from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.post import Post
from app.models.club import Club
from app.models.event import Event
from app.models.marketplace import MarketplaceListing
from app.models.messaging import Message

# Role-gate the entire router so any future admin endpoint added here is
# automatically protected — a hand-written inline check on each route is too
# easy to forget and would silently expose privileged data.
router = APIRouter(
    prefix="/admin",
    tags=["Admin"],
    dependencies=[Depends(require_role(UserRole.admin, UserRole.university_staff))],
)


@router.get("/stats")
async def get_admin_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
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
