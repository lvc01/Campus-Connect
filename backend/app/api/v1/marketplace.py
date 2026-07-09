import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import NotFoundException
from app.core.rate_limiter import rate_limit
from app.models.marketplace import MarketplaceListing
from app.models.user import User
from app.schemas.common import MessageResponse, PaginatedResponse
from app.schemas.marketplace import (
    ListingCategory,
    ListingCreate,
    ListingResponse,
    ListingStatus,
    ListingUpdate,
    SellerRatingCreate,
    SellerRatingResponse,
    SellerRatingsSummary,
)
from app.services.marketplace_service import get_marketplace_service

router = APIRouter(prefix="/marketplace", tags=["Marketplace"])
service = get_marketplace_service()


def _listing_to_response(listing: MarketplaceListing, avg_rating: float = 0.0, rating_count: int = 0) -> ListingResponse:
    """Convert a MarketplaceListing ORM object to ListingResponse safely."""
    d = {
        "id": listing.id,
        "seller_id": listing.seller_id,
        "title": listing.title,
        "description": listing.description,
        "price": float(listing.price),
        "category": listing.category.value,
        "condition": listing.condition.value if listing.condition else None,
        "status": listing.status.value,
        "view_count": listing.view_count,
        "created_at": listing.created_at,
        "updated_at": listing.updated_at,
        "seller": listing.seller,
        "images": listing.images,
        "is_saved": getattr(listing, "is_saved", False),
    }
    res = ListingResponse.model_validate(d)
    res.avg_rating = avg_rating
    res.rating_count = rating_count
    return res


@router.post("/listings", response_model=ListingResponse, status_code=status.HTTP_201_CREATED, summary="Create a marketplace listing", dependencies=[Depends(rate_limit(max_requests=20, window_seconds=3600))])
async def create_listing(
    data: ListingCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ListingResponse:
    listing = await service.create_listing(current_user.id, data, db)
    return _listing_to_response(listing)


@router.get("/listings", response_model=PaginatedResponse, summary="List marketplace listings")
async def get_listings(
    category: ListingCategory | None = Query(default=None),
    search: str | None = Query(default=None),
    seller_id: uuid.UUID | None = Query(default=None),
    saved_only: bool = Query(default=False),
    status: ListingStatus | None = Query(default=None),
    sort: str = Query(default="newest", description="Sort: newest, oldest, price_low, price_high"),
    min_price: float | None = Query(default=None),
    max_price: float | None = Query(default=None),
    cursor: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse:
    listings, next_cursor, page_limit = await service.get_listings(
        db,
        user_id=current_user.id,
        category=category,
        search=search,
        seller_id=seller_id,
        saved_only=saved_only,
        status=status,
        sort=sort,
        min_price=min_price,
        max_price=max_price,
        cursor=cursor,
        limit=limit,
    )
    # Bulk-fetch seller ratings (avoids N+1)
    seller_ids = list({item.seller_id for item in listings})
    ratings_map = await service.get_bulk_seller_ratings(seller_ids, db)

    items = []
    for item in listings:
        avg_r, cnt_r = ratings_map.get(item.seller_id, (0.0, 0))
        items.append(_listing_to_response(item, avg_r, cnt_r))
    return PaginatedResponse(
        items=items,
        next_cursor=next_cursor,
        has_more=next_cursor is not None,
        total=None,
    )


@router.get("/listings/{listing_id}", response_model=ListingResponse, summary="Get a single listing")
async def get_listing(
    listing_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ListingResponse:
    listing = await service.get_listing_by_id(listing_id, db, user_id=current_user.id)
    if not listing:
        raise NotFoundException(detail="Listing not found.")
    # Bump view count using raw UPDATE (no ORM expiry)
    await db.execute(
        update(MarketplaceListing)
        .where(MarketplaceListing.id == listing_id)
        .values(view_count=MarketplaceListing.view_count + 1)
        .execution_options(synchronize_session=False)
    )
    await db.flush()
    avg_r, cnt_r, _ = await service.get_seller_ratings(listing.seller_id, db)
    listing.view_count += 1
    res = _listing_to_response(listing, avg_r, cnt_r)
    return res


@router.patch("/listings/{listing_id}", response_model=ListingResponse, summary="Update a listing")
async def update_listing(
    listing_id: uuid.UUID,
    data: ListingUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ListingResponse:
    listing = await service.update_listing(listing_id, current_user.id, data, db)
    avg_r, cnt_r, _ = await service.get_seller_ratings(listing.seller_id, db)
    return _listing_to_response(listing, avg_r, cnt_r)


@router.delete("/listings/{listing_id}", response_model=MessageResponse, summary="Delete a listing")
async def delete_listing(
    listing_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    await service.delete_listing(listing_id, current_user.id, db)
    return MessageResponse(message="Listing deleted.")


@router.post("/listings/{listing_id}/save", response_model=MessageResponse, summary="Save/bookmark a listing")
async def save_listing(
    listing_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    await service.save_listing(current_user.id, listing_id, db)
    return MessageResponse(message="Listing saved.")


@router.delete("/listings/{listing_id}/save", response_model=MessageResponse, summary="Unsave/remove bookmark")
async def unsave_listing(
    listing_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    await service.unsave_listing(current_user.id, listing_id, db)
    return MessageResponse(message="Listing unsaved.")


@router.post("/listings/{listing_id}/ratings", response_model=SellerRatingResponse, status_code=status.HTTP_201_CREATED, summary="Rate a seller for a listing", dependencies=[Depends(rate_limit(max_requests=10, window_seconds=3600))])
async def create_rating(
    listing_id: uuid.UUID,
    data: SellerRatingCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SellerRatingResponse:
    rating = await service.create_rating(current_user.id, listing_id, data, db)
    return SellerRatingResponse.model_validate(rating)


@router.get("/sellers/{seller_id}/ratings", response_model=SellerRatingsSummary, summary="Get seller ratings summary")
async def get_seller_ratings(
    seller_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SellerRatingsSummary:
    avg_r, cnt_r, ratings = await service.get_seller_ratings(seller_id, db)
    return SellerRatingsSummary(
        avg_rating=avg_r,
        total_ratings=cnt_r,
        ratings=[SellerRatingResponse.model_validate(r) for r in ratings],
    )
