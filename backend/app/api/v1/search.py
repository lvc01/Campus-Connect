from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.rate_limiter import rate_limit
from app.models.user import User
from app.services.search_service import get_search_service

router = APIRouter(prefix="/search", tags=["Search"])
service = get_search_service()


@router.get(
    "",
    summary="Global search across users, posts, clubs, events, and marketplace",
    dependencies=[Depends(rate_limit(max_requests=30, window_seconds=60))],
)
async def global_search(
    q: str = Query(..., min_length=2, max_length=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    results = await service.global_search(q, db)
    return results
