import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict

from app.schemas.user import UserResponse


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    type: str
    title: str
    body: str | None = None
    data: dict | None = None
    is_read: bool = False
    created_at: datetime
    actor: UserResponse | None = None


class NotificationListResponse(BaseModel):
    items: list[NotificationResponse]
    unread_count: int
    next_cursor: str | None = None
    has_more: bool = False


class MarkReadRequest(BaseModel):
    notification_ids: list[uuid.UUID]


class UnreadCountResponse(BaseModel):
    unread_count: int
