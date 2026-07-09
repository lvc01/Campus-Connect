import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.models.marketplace import ListingCategory, ListingCondition, ListingStatus
from app.schemas.user import UserResponse


class MediaItem(BaseModel):
    url: str = Field(max_length=500)
    media_type: str = Field(default="image", pattern="^(image|video)$")


class ListingBase(BaseModel):
    title: str = Field(min_length=2, max_length=300)
    description: str | None = Field(default=None, max_length=5000)
    price: float = Field(ge=0)
    category: ListingCategory
    condition: ListingCondition | None = None
    location: str | None = Field(default=None, max_length=300)
    # Bound the image list and each URL's length to prevent storage abuse.
    image_urls: list[str] | None = Field(default=None, max_length=10)
    # New: media items with type (image or video)
    media_items: list[MediaItem] | None = Field(default=None, max_length=10)

    @field_validator("image_urls")
    @classmethod
    def validate_image_urls(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return v
        for url in v:
            if len(url) > 500:
                raise ValueError("Each image URL must be 500 characters or fewer.")
        return v


class ListingCreate(ListingBase):
    pass


class ListingUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=300)
    description: str | None = Field(default=None, max_length=5000)
    price: float | None = Field(default=None, ge=0)
    category: ListingCategory | None = None
    condition: ListingCondition | None = None
    location: str | None = Field(default=None, max_length=300)
    status: ListingStatus | None = None
    image_urls: list[str] | None = Field(default=None, max_length=10)

    @field_validator("image_urls")
    @classmethod
    def validate_image_urls(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return v
        for url in v:
            if len(url) > 500:
                raise ValueError("Each image URL must be 500 characters or fewer.")
        return v


class ListingImageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    url: str
    media_type: str
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
