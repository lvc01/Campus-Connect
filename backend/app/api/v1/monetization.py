import uuid
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.monetization import (
    ActiveAdResponse,
    AdCreate,
    AdResponse,
    AdUpdate,
)
from app.services.monetization_service import get_monetization_service

router = APIRouter(prefix="/ads", tags=["Monetization"])
service = get_monetization_service()


@router.post(
    "",
    response_model=AdResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create an ad placement",
)
async def create_ad(
    data: AdCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AdResponse:
    ad = await service.create_ad(current_user.id, data, db)
    return AdResponse.model_validate(ad)


@router.get(
    "",
    response_model=list[AdResponse],
    summary="List my ads",
)
async def list_my_ads(
    cursor: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[AdResponse]:
    ads, _, _ = await service.list_my_ads(current_user.id, db, cursor, limit)
    return [AdResponse.model_validate(a) for a in ads]


@router.get(
    "/active",
    response_model=ActiveAdResponse | None,
    summary="Get a random active ad for feed placement",
)
async def get_active_ad(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ActiveAdResponse | None:
    ad = await service.get_active_ad(db)
    if not ad:
        return None
    return ActiveAdResponse.model_validate(ad)


@router.get(
    "/{ad_id}",
    response_model=AdResponse,
    summary="Get a single ad",
)
async def get_ad(
    ad_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AdResponse:
    ad = await service.get_ad(ad_id, db)
    return AdResponse.model_validate(ad)


@router.patch(
    "/{ad_id}",
    response_model=AdResponse,
    summary="Update an ad",
)
async def update_ad(
    ad_id: uuid.UUID,
    data: AdUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AdResponse:
    ad = await service.update_ad(ad_id, current_user.id, data, db)
    return AdResponse.model_validate(ad)


@router.delete(
    "/{ad_id}",
    response_model=MessageResponse,
    summary="Delete an ad",
)
async def delete_ad(
    ad_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    await service.delete_ad(ad_id, current_user.id, db)
    return MessageResponse(message="Ad deleted.")


@router.post(
    "/{ad_id}/impression",
    response_model=MessageResponse,
    summary="Increment ad impression count",
)
async def track_impression(
    ad_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    await service.increment_impression(ad_id, db)
    return MessageResponse(message="Impression tracked.")


@router.post(
    "/{ad_id}/click",
    response_model=MessageResponse,
    summary="Increment ad click count",
)
async def track_click(
    ad_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    await service.increment_click(ad_id, db)
    return MessageResponse(message="Click tracked.")
