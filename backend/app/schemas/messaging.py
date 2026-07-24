import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from app.models.messaging import ConversationType, MessageType
from app.schemas.user import UserResponse


class ConversationMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user: UserResponse
    role: str
    last_read_at: datetime | None = None
    is_muted: bool = False


class ConversationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    type: ConversationType
    name: str | None = None
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime
    members: list[ConversationMemberResponse] = Field(default_factory=list)
    last_message: str | None = None
    last_message_at: datetime | None = None
    last_sender_id: uuid.UUID | None = None
    unread_count: int = 0


class MessageReactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    emoji: str
    created_at: datetime


class MessageReplyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    sender: UserResponse
    content: str | None = None
    message_type: MessageType = MessageType.text


class MessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    conversation_id: uuid.UUID
    sender: UserResponse
    content: str | None = None
    message_type: MessageType
    file_url: str | None = None
    reply_to: MessageReplyResponse | None = None
    reactions: list[MessageReactionResponse] = []
    edited_at: datetime | None = None
    created_at: datetime


class SendMessageRequest(BaseModel):
    content: str | None = Field(default=None, max_length=5000)
    message_type: MessageType = MessageType.text
    file_url: str | None = Field(default=None, max_length=500)
    reply_to_message_id: uuid.UUID | None = None


class EditMessageRequest(BaseModel):
    content: str = Field(max_length=5000)


class ReactionRequest(BaseModel):
    emoji: str = Field(max_length=10)


class CreateConversationRequest(BaseModel):
    type: ConversationType = ConversationType.direct
    name: str | None = Field(default=None, max_length=200)
    member_ids: list[uuid.UUID] = Field(min_length=1, max_length=100)


class UnreadCountResponse(BaseModel):
    total: int = 0
    conversations: dict = Field(default_factory=dict)
