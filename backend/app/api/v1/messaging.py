import uuid
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import NotFoundException
from app.models.messaging import ConversationMember
from app.models.notification import NotificationType
from app.models.user import User
from app.schemas.common import MessageResponse, PaginatedResponse
from app.schemas.messaging import (
    ConversationResponse,
    CreateConversationRequest,
    EditMessageRequest,
    MessageReactionResponse,
    MessageResponse as MessageResp,
    ReactionRequest,
    SendMessageRequest,
    UnreadCountResponse,
)
from app.services.messaging_service import get_messaging_service
from app.services.notification_service import get_notification_service
from sqlalchemy import select

router = APIRouter(prefix="/messaging", tags=["Messaging"])


@router.get("/conversations", response_model=list[ConversationResponse], summary="List user conversations")
async def get_conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ConversationResponse]:
    service = get_messaging_service()
    conversations = await service.get_user_conversations(current_user.id, db)
    unread_data = await service.get_unread_counts(current_user.id, db)
    conv_unreads = unread_data.get("conversations", {})

    responses = []
    for conv in conversations:
        last_msg = await service.get_last_message(conv.id, db)
        res = ConversationResponse.model_validate(conv)
        if last_msg:
            sender_name = last_msg.sender.profile.display_name if last_msg.sender.profile else last_msg.sender.email.split("@")[0]
            res.last_message = f"{sender_name}: {last_msg.content or '[Attachment]'}"
            res.last_message_at = last_msg.created_at
            res.last_sender_id = last_msg.sender_id
        res.unread_count = conv_unreads.get(str(conv.id), 0)
        responses.append(res)
    return responses


@router.post("/conversations", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED, summary="Create or get a DM conversation")
async def create_conversation(
    data: CreateConversationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ConversationResponse:
    service = get_messaging_service()
    if data.type == "direct" and len(data.member_ids) == 1:
        conv = await service.create_or_get_direct_conversation(current_user.id, data.member_ids[0], db)
    else:
        conv = await service.create_group_conversation(current_user.id, data, db)
    return ConversationResponse.model_validate(conv)


@router.get("/conversations/{conversation_id}/messages", response_model=PaginatedResponse, summary="Get messages in a conversation")
async def get_messages(
    conversation_id: uuid.UUID,
    cursor: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse:
    service = get_messaging_service()
    messages, next_cursor, has_more = await service.get_conversation_messages(
        conversation_id, current_user.id, db, cursor, limit,
    )
    items = [MessageResp.model_validate(m) for m in messages]
    return PaginatedResponse(items=items, next_cursor=next_cursor, has_more=has_more)


@router.post("/conversations/{conversation_id}/messages", response_model=MessageResp, status_code=status.HTTP_201_CREATED, summary="Send a message")
async def send_message(
    conversation_id: uuid.UUID,
    data: SendMessageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResp:
    service = get_messaging_service()
    notification_service = get_notification_service()
    msg = await service.send_message(conversation_id, current_user.id, data, db)
    members = await db.execute(
        select(ConversationMember.user_id).where(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id != current_user.id,
        )
    )
    for (member_id,) in members.fetchall():
        await notification_service.create_notification(
            user_id=member_id,
            type=NotificationType.dm,
            title=f"{current_user.profile.display_name or current_user.email.split('@')[0]} sent you a message",
            body=data.content[:200] if data.content else None,
            data={"conversation_id": str(conversation_id)},
            actor_id=current_user.id,
            db=db,
        )
    return MessageResp.model_validate(msg)


@router.post("/conversations/{conversation_id}/read", response_model=MessageResponse, summary="Mark conversation as read")
async def mark_read(
    conversation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    service = get_messaging_service()
    await service.mark_conversation_read(conversation_id, current_user.id, db)
    return MessageResponse(message="Marked as read.")


@router.get("/unread", response_model=UnreadCountResponse, summary="Get unread message counts")
async def get_unread(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UnreadCountResponse:
    service = get_messaging_service()
    data = await service.get_unread_counts(current_user.id, db)
    return UnreadCountResponse(**data)


@router.patch(
    "/conversations/{conversation_id}/messages/{message_id}",
    response_model=MessageResp,
    summary="Edit a message",
)
async def edit_message(
    conversation_id: uuid.UUID,
    message_id: uuid.UUID,
    data: EditMessageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResp:
    service = get_messaging_service()
    msg = await service.edit_message(conversation_id, message_id, current_user.id, data.content, db)
    return MessageResp.model_validate(msg)


@router.delete(
    "/conversations/{conversation_id}/messages/{message_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a message",
)
async def delete_message(
    conversation_id: uuid.UUID,
    message_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    service = get_messaging_service()
    await service.delete_message(conversation_id, message_id, current_user.id, db)


@router.post(
    "/conversations/{conversation_id}/messages/{message_id}/reactions",
    response_model=list[MessageReactionResponse],
    summary="Toggle a reaction on a message",
)
async def toggle_reaction(
    conversation_id: uuid.UUID,
    message_id: uuid.UUID,
    data: ReactionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[MessageReactionResponse]:
    service = get_messaging_service()
    reactions = await service.toggle_reaction(conversation_id, message_id, current_user.id, data.emoji, db)
    return [MessageReactionResponse.model_validate(r) for r in reactions]


@router.post(
    "/conversations/{conversation_id}/mute",
    summary="Toggle mute on a conversation",
)
async def toggle_mute(
    conversation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    service = get_messaging_service()
    is_muted = await service.toggle_mute(conversation_id, current_user.id, db)
    return {"is_muted": is_muted}


@router.get(
    "/conversations/{conversation_id}/messages/search",
    response_model=list[MessageResp],
    summary="Search messages within a conversation",
)
async def search_messages(
    conversation_id: uuid.UUID,
    q: str = Query(..., min_length=1, max_length=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[MessageResp]:
    service = get_messaging_service()
    messages = await service.search_messages(conversation_id, current_user.id, q, db)
    return [MessageResp.model_validate(m) for m in messages]


@router.get(
    "/presence/{user_id}",
    summary="Check if a user is online",
)
async def get_presence(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
) -> dict:
    from app.websocket.manager import manager
    return {"is_online": manager.is_online(str(user_id))}
