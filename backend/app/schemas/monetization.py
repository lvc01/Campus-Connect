import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

from app.models.monetization import AdStatus


class AdCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    content: str | None = Field(default=None, max_length=2000)
    image_url: str | None = Field(default=None, max_length=500)
    target_url: str | None = Field(default=None, max_length=500)
    boosted_post_id: uuid.UUID | None = None
    daily_budget: int | None = Field(default=None, ge=1)
    total_budget: int | None = Field(default=None, ge=1)
    target_faculty: str | None = Field(default=None, max_length=100)


class AdUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    content: str | None = Field(default=None, max_length=2000)
    image_url: str | None = Field(default=None, max_length=500)
    target_url: str | None = Field(default=None, max_length=500)
    status: AdStatus | None = None
    daily_budget: int | None = Field(default=None, ge=1)
    total_budget: int | None = Field(default=None, ge=1)
    target_faculty: str | None = Field(default=None, max_length=100)


class AdResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    advertiser_id: uuid.UUID
    boosted_post_id: uuid.UUID | None = None
    title: str
    content: str | None = None
    image_url: str | None = None
    target_url: str | None = None
    status: AdStatus
    daily_budget: int | None = None
    total_budget: int | None = None
    target_faculty: str | None = None
    impression_count: int = 0
    click_count: int = 0
    start_date: datetime | None = None
    end_date: datetime | None = None
    created_at: datetime
    updated_at: datetime


class ActiveAdResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    content: str | None = None
    image_url: str | None = None
    target_url: str | None = None
    boosted_post_id: uuid.UUID | None = None
