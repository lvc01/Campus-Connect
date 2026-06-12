import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from app.models.marketplace import ListingCategory, ListingCondition, ListingStatus
from app.schemas.user import UserResponse


class ListingBase(BaseModel):
    title: str = Field(min_length=2, max_length=300)
    description: str | None = Field(default=None, max_length=5000)
    price: float = Field(ge=0)
    category: ListingCategory
    condition: ListingCondition | None = None
    image_urls: list[str] | None = Field(default=None)


class ListingCreate(ListingBase):
    pass


class ListingUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=300)
    description: str | None = Field(default=None, max_length=5000)
    price: float | None = Field(default=None, ge=0)
    category: ListingCategory | None = None
    condition: ListingCondition | None = None
    status: ListingStatus | None = None
    image_urls: list[str] | None = None


class ListingImageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    url: str
    order: int
    created_at: datetime


class ListingResponse(ListingBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    seller_id: uuid.UUID
    seller: UserResponse
    status: ListingStatus
    view_count: int
    created_at: datetime
    updated_at: datetime
    images: list[ListingImageResponse] = Field(default_factory=list)
    avg_rating: float = 0.0
    rating_count: int = 0
    is_saved: bool = False


class SellerRatingCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    review: str | None = Field(default=None, max_length=2000)


class SellerRatingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    seller_id: uuid.UUID
    buyer: UserResponse
    listing_id: uuid.UUID
    rating: int
    review: str | None
    created_at: datetime


class SellerRatingsSummary(BaseModel):
    avg_rating: float = 0.0
    total_ratings: int = 0
    ratings: list[SellerRatingResponse] = Field(default_factory=list)
