import uuid
from datetime import datetime, timezone
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import ForbiddenException, NotFoundException
from app.models.monetization import Ad, AdStatus
from app.models.user import User
from app.schemas.monetization import AdCreate, AdUpdate
from app.utils.pagination import paginate as paginate_fn


class MonetizationService:
    async def create_ad(
        self,
        advertiser_id: uuid.UUID,
        data: AdCreate,
        db: AsyncSession,
    ) -> Ad:
        ad = Ad(
            advertiser_id=advertiser_id,
            boosted_post_id=data.boosted_post_id,
            title=data.title,
            content=data.content,
            image_url=data.image_url,
            target_url=data.target_url,
            daily_budget=data.daily_budget,
            total_budget=data.total_budget,
            target_faculty=data.target_faculty,
        )
        db.add(ad)
        await db.flush()

        result = await db.execute(
            select(Ad).options(
                selectinload(Ad.advertiser).selectinload(User.profile),
            ).where(Ad.id == ad.id)
        )
        return result.scalar_one()

    async def list_my_ads(
        self,
        advertiser_id: uuid.UUID,
        db: AsyncSession,
        cursor: str | None = None,
        limit: int = 20,
    ) -> tuple[list[Ad], str | None, bool]:
        query = (
            select(Ad)
            .where(Ad.advertiser_id == advertiser_id)
        )
        result = await paginate_fn(db, query, cursor, limit, Ad.created_at)
        return result["items"], result["next_cursor"], result["has_more"]

    async def get_ad(self, ad_id: uuid.UUID, db: AsyncSession) -> Ad:
        result = await db.execute(
            select(Ad).where(Ad.id == ad_id)
        )
        ad = result.scalar_one_or_none()
        if not ad:
            raise NotFoundException(detail="Ad not found.")
        return ad

    async def update_ad(
        self,
        ad_id: uuid.UUID,
        user_id: uuid.UUID,
        data: AdUpdate,
        db: AsyncSession,
    ) -> Ad:
        ad = await self.get_ad(ad_id, db)
        if ad.advertiser_id != user_id:
            raise ForbiddenException(detail="You can only edit your own ads.")

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(ad, key, value)
        await db.flush()

        result = await db.execute(
            select(Ad).where(Ad.id == ad.id)
        )
        return result.scalar_one()

    async def delete_ad(self, ad_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> None:
        ad = await self.get_ad(ad_id, db)
        if ad.advertiser_id != user_id:
            raise ForbiddenException(detail="You can only delete your own ads.")
        await db.delete(ad)
        await db.flush()

    async def get_active_ad(self, db: AsyncSession) -> Ad | None:
        now = datetime.now(timezone.utc)
        query = (
            select(Ad)
            .where(
                Ad.status == AdStatus.active,
                (Ad.start_date.is_(None) | (Ad.start_date <= now)),
                (Ad.end_date.is_(None) | (Ad.end_date >= now)),
            )
            .order_by(func.random())
            .limit(1)
        )
        result = await db.execute(query)
        return result.scalar_one_or_none()

    async def increment_impression(self, ad_id: uuid.UUID, db: AsyncSession) -> int:
        await db.execute(
            update(Ad)
            .where(Ad.id == ad_id)
            .values(impression_count=Ad.impression_count + 1)
        )
        await db.flush()
        ad = await self.get_ad(ad_id, db)
        return ad.impression_count

    async def increment_click(self, ad_id: uuid.UUID, db: AsyncSession) -> int:
        await db.execute(
            update(Ad)
            .where(Ad.id == ad_id)
            .values(click_count=Ad.click_count + 1)
        )
        await db.flush()
        ad = await self.get_ad(ad_id, db)
        return ad.click_count


def get_monetization_service() -> MonetizationService:
    return MonetizationService()
