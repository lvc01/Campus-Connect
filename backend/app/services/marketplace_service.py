import uuid
from datetime import datetime
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import BadRequestException, ForbiddenException, NotFoundException
from app.models.marketplace import (
    ListingCategory,
    ListingImage,
    ListingSave,
    ListingStatus,
    MarketplaceListing,
    SellerRating,
)
from app.models.user import User
from app.schemas.marketplace import ListingCreate, ListingUpdate, SellerRatingCreate


class MarketplaceService:
    """Handles marketplace listing lifecycle, ratings, and saves."""

    async def create_listing(
        self,
        seller_id: uuid.UUID,
        data: ListingCreate,
        db: AsyncSession,
    ) -> MarketplaceListing:
        listing = MarketplaceListing(
            seller_id=seller_id,
            title=data.title.strip(),
            description=data.description.strip() if data.description else None,
            price=data.price,
            category=data.category,
            condition=data.condition,
        )
        db.add(listing)
        await db.flush()

        # Handle new media_items with types (image or video)
        if data.media_items:
            for idx, item in enumerate(data.media_items):
                db.add(ListingImage(
                    listing_id=listing.id,
                    url=item.url.strip(),
                    media_type=item.media_type,
                    order=idx,
                ))
        elif data.image_urls:
            # Backward compatibility: treat image_urls as images
            for idx, url in enumerate(data.image_urls):
                db.add(ListingImage(
                    listing_id=listing.id,
                    url=url.strip(),
                    media_type="image",
                    order=idx,
                ))

        await db.flush()

        result = await db.execute(
            select(MarketplaceListing)
            .options(selectinload(MarketplaceListing.seller).selectinload(User.profile))
            .options(selectinload(MarketplaceListing.images))
            .where(MarketplaceListing.id == listing.id)
        )
        return result.scalar_one()

    async def get_listings(
        self,
        db: AsyncSession,
        user_id: uuid.UUID | None = None,
        category: ListingCategory | None = None,
        search: str | None = None,
        seller_id: uuid.UUID | None = None,
        saved_only: bool = False,
        status: ListingStatus | None = None,
        sort: str = "newest",
        min_price: float | None = None,
        max_price: float | None = None,
        cursor: str | None = None,
        limit: int = 20,
    ) -> tuple[list[MarketplaceListing], str | None, int]:
        query = (
            select(MarketplaceListing)
            .options(selectinload(MarketplaceListing.seller).selectinload(User.profile))
            .options(selectinload(MarketplaceListing.images))
            .where(MarketplaceListing.deleted_at.is_(None))
        )

        if saved_only and user_id:
            query = query.join(ListingSave).where(ListingSave.user_id == user_id)
        else:
            filter_status = status or ListingStatus.active
            query = query.where(MarketplaceListing.status == filter_status)

        if category:
            query = query.where(MarketplaceListing.category == category)
        if seller_id:
            query = query.where(MarketplaceListing.seller_id == seller_id)
        if search:
            sterm = f"%{search.strip()}%"
            query = query.where(
                MarketplaceListing.title.ilike(sterm)
                | MarketplaceListing.description.ilike(sterm)
            )
        if min_price is not None:
            query = query.where(MarketplaceListing.price >= min_price)
        if max_price is not None:
            query = query.where(MarketplaceListing.price <= max_price)

        if cursor:
            try:
                cursor_dt = datetime.fromisoformat(cursor)
                query = query.where(MarketplaceListing.created_at < cursor_dt)
            except (ValueError, TypeError):
                pass

        sort_map = {
            "newest": MarketplaceListing.created_at.desc(),
            "oldest": MarketplaceListing.created_at.asc(),
            "price_low": MarketplaceListing.price.asc(),
            "price_high": MarketplaceListing.price.desc(),
            "views_desc": MarketplaceListing.view_count.desc(),
            "rating_desc": func.coalesce(
                func.avg(SellerRating.rating), 0
            ).desc(),
        }
        
        # For rating sort, join with ratings table
        if sort == "rating_desc":
            query = query.outerjoin(SellerRating, MarketplaceListing.id == SellerRating.listing_id)
            query = query.group_by(MarketplaceListing.id)
        
        query = query.order_by(sort_map.get(sort, MarketplaceListing.created_at.desc()))

        result = await db.execute(query.limit(limit + 1))
        listings = list(result.scalars().all())
        has_more = len(listings) > limit
        if has_more:
            listings = listings[:limit]

        next_cursor = None
        if has_more and listings:
            next_cursor = listings[-1].created_at.isoformat()

        if user_id and listings:
            listing_ids = [l.id for l in listings]
            saves_result = await db.execute(
                select(ListingSave.listing_id).where(
                    ListingSave.user_id == user_id,
                    ListingSave.listing_id.in_(listing_ids),
                )
            )
            saved_ids = {r for (r,) in saves_result.all()}
            for listing in listings:
                listing.is_saved = listing.id in saved_ids

        return listings, next_cursor, limit

    async def get_listing_by_id(
        self,
        listing_id: uuid.UUID,
        db: AsyncSession,
        user_id: uuid.UUID | None = None,
    ) -> MarketplaceListing | None:
        result = await db.execute(
            select(MarketplaceListing)
            .options(selectinload(MarketplaceListing.seller).selectinload(User.profile))
            .options(selectinload(MarketplaceListing.images))
            .where(MarketplaceListing.id == listing_id, MarketplaceListing.deleted_at.is_(None))
        )
        listing = result.scalar_one_or_none()
        if listing and user_id:
            save_check = await db.execute(
                select(ListingSave).where(
                    ListingSave.user_id == user_id,
                    ListingSave.listing_id == listing_id,
                )
            )
            listing.is_saved = save_check.scalar_one_or_none() is not None
        return listing

    async def increment_view_count_safe(
        self,
        listing: MarketplaceListing,
        db: AsyncSession,
    ) -> None:
        """Increment view count without expiring the ORM object."""
        await db.execute(
            update(MarketplaceListing)
            .where(MarketplaceListing.id == listing.id)
            .values(view_count=MarketplaceListing.view_count + 1)
            .execution_options(synchronize_session=False)
        )
        listing.view_count += 1
        await db.flush()

    async def update_listing(
        self,
        listing_id: uuid.UUID,
        seller_id: uuid.UUID,
        data: ListingUpdate,
        db: AsyncSession,
    ) -> MarketplaceListing:
        result = await db.execute(
            select(MarketplaceListing)
            .options(selectinload(MarketplaceListing.seller).selectinload(User.profile))
            .options(selectinload(MarketplaceListing.images))
            .where(MarketplaceListing.id == listing_id, MarketplaceListing.deleted_at.is_(None))
        )
        listing = result.scalar_one_or_none()
        if not listing:
            raise NotFoundException(detail="Listing not found.")
        if listing.seller_id != seller_id:
            raise ForbiddenException(detail="You can only edit your own listings.")

        if data.title is not None:
            listing.title = data.title.strip()
        if data.description is not None:
            listing.description = data.description.strip() if data.description else None
        if data.price is not None:
            listing.price = data.price
        if data.category is not None:
            listing.category = data.category
        if data.condition is not None:
            listing.condition = data.condition
        if data.status is not None:
            listing.status = data.status
        if data.media_items is not None:
            existing_images = await db.execute(
                select(ListingImage).where(ListingImage.listing_id == listing_id)
            )
            for img in existing_images.scalars().all():
                await db.delete(img)
            for idx, item in enumerate(data.media_items):
                db.add(ListingImage(
                    listing_id=listing_id,
                    url=item.url.strip(),
                    media_type=item.media_type,
                    order=idx,
                ))
        elif data.image_urls is not None:
            existing_images = await db.execute(
                select(ListingImage).where(ListingImage.listing_id == listing_id)
            )
            for img in existing_images.scalars().all():
                await db.delete(img)
            for idx, url in enumerate(data.image_urls):
                db.add(ListingImage(
                    listing_id=listing_id,
                    url=url.strip(),
                    media_type="image",
                    order=idx,
                ))

        await db.flush()
        await db.refresh(listing)
        return listing

    async def delete_listing(
        self,
        listing_id: uuid.UUID,
        seller_id: uuid.UUID,
        db: AsyncSession,
    ) -> None:
        result = await db.execute(
            select(MarketplaceListing).where(
                MarketplaceListing.id == listing_id,
                MarketplaceListing.deleted_at.is_(None),
            )
        )
        listing = result.scalar_one_or_none()
        if not listing:
            raise NotFoundException(detail="Listing not found.")
        if listing.seller_id != seller_id:
            raise ForbiddenException(detail="You can only delete your own listings.")
        listing.deleted_at = func.now()
        await db.flush()

    async def create_rating(
        self,
        buyer_id: uuid.UUID,
        listing_id: uuid.UUID,
        data: SellerRatingCreate,
        db: AsyncSession,
    ) -> SellerRating:
        result = await db.execute(
            select(MarketplaceListing).where(
                MarketplaceListing.id == listing_id,
                MarketplaceListing.deleted_at.is_(None),
            )
        )
        listing = result.scalar_one_or_none()
        if not listing:
            raise NotFoundException(detail="Listing not found.")
        if listing.seller_id == buyer_id:
            raise BadRequestException(detail="You cannot rate your own listing.")

        existing = await db.execute(
            select(SellerRating).where(
                SellerRating.buyer_id == buyer_id,
                SellerRating.listing_id == listing_id,
            )
        )
        if existing.scalar_one_or_none() is not None:
            raise BadRequestException(detail="You have already rated this listing.")

        rating = SellerRating(
            seller_id=listing.seller_id,
            buyer_id=buyer_id,
            listing_id=listing_id,
            rating=data.rating,
            review=data.review.strip() if data.review else None,
        )
        db.add(rating)
        await db.flush()

        result = await db.execute(
            select(SellerRating)
            .options(selectinload(SellerRating.buyer).selectinload(User.profile))
            .where(SellerRating.id == rating.id)
        )
        return result.scalar_one()

    async def get_seller_ratings(
        self,
        seller_id: uuid.UUID,
        db: AsyncSession,
    ) -> tuple[float, int, list[SellerRating]]:
        result = await db.execute(
            select(SellerRating)
            .options(selectinload(SellerRating.buyer).selectinload(User.profile))
            .where(SellerRating.seller_id == seller_id)
            .order_by(SellerRating.created_at.desc())
        )
        ratings = list(result.scalars().all())
        avg = sum(r.rating for r in ratings) / len(ratings) if ratings else 0.0
        return round(avg, 1), len(ratings), ratings

    async def get_bulk_seller_ratings(
        self,
        seller_ids: list[uuid.UUID],
        db: AsyncSession,
    ) -> dict[uuid.UUID, tuple[float, int]]:
        """Return ``{seller_id: (avg_rating, count)}`` for all given sellers in one query."""
        if not seller_ids:
            return {}

        result = await db.execute(
            select(
                SellerRating.seller_id,
                func.avg(SellerRating.rating),
                func.count(SellerRating.id),
            )
            .where(SellerRating.seller_id.in_(set(seller_ids)))
            .group_by(SellerRating.seller_id)
        )
        rows = result.all()
        return {
            row.seller_id: (round(float(row[1]), 1), row[2])
            for row in rows
        }

    async def save_listing(
        self,
        user_id: uuid.UUID,
        listing_id: uuid.UUID,
        db: AsyncSession,
    ) -> None:
        result = await db.execute(
            select(MarketplaceListing).where(
                MarketplaceListing.id == listing_id,
                MarketplaceListing.deleted_at.is_(None),
            )
        )
        if result.scalar_one_or_none() is None:
            raise NotFoundException(detail="Listing not found.")

        existing = await db.execute(
            select(ListingSave).where(
                ListingSave.user_id == user_id,
                ListingSave.listing_id == listing_id,
            )
        )
        if existing.scalar_one_or_none() is not None:
            return

        db.add(ListingSave(user_id=user_id, listing_id=listing_id))
        await db.flush()

    async def unsave_listing(
        self,
        user_id: uuid.UUID,
        listing_id: uuid.UUID,
        db: AsyncSession,
    ) -> None:
        existing = await db.execute(
            select(ListingSave).where(
                ListingSave.user_id == user_id,
                ListingSave.listing_id == listing_id,
            )
        )
        save_record = existing.scalar_one_or_none()
        if not save_record:
            return
        await db.delete(save_record)
        await db.flush()


def get_marketplace_service() -> MarketplaceService:
    """Return a MarketplaceService instance."""
    return MarketplaceService()
