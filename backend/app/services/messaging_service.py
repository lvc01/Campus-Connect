import uuid
from datetime import datetime, timezone
from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import BadRequestException, NotFoundException
from app.models.messaging import (
    Conversation,
    ConversationMember,
    ConversationMemberRole,
    ConversationType,
    Message,
    MessageReaction,
    MessageType,
)
from app.models.user import User
from app.schemas.messaging import (
    ConversationResponse,
    CreateConversationRequest,
    MessageResponse,
    SendMessageRequest,
)


class MessagingService:
    """Handles conversations, messages, and read-state tracking."""

    async def create_or_get_direct_conversation(
        self,
        creator_id: uuid.UUID,
        other_user_id: uuid.UUID,
        db: AsyncSession,
    ) -> Conversation:
        """Find or create a 1:1 DM between two users."""
        if creator_id == other_user_id:
            raise BadRequestException(detail="Cannot start a conversation with yourself.")

        # Check if DM already exists
        subq = (
            select(ConversationMember.conversation_id)
            .where(ConversationMember.user_id == creator_id)
        ).subquery()
        existing = await db.execute(
            select(Conversation)
            .join(ConversationMember, Conversation.id == ConversationMember.conversation_id)
            .where(
                Conversation.type == ConversationType.direct,
                ConversationMember.user_id == other_user_id,
                Conversation.id.in_(select(subq.c.conversation_id)),
            )
        )
        conv = existing.scalar_one_or_none()
        if conv:
            result = await db.execute(
                select(Conversation)
                .options(
                    selectinload(Conversation.members).selectinload(ConversationMember.user).selectinload(User.profile),
                )
                .where(Conversation.id == conv.id)
            )
            return result.scalar_one()

        conv = Conversation(
            type=ConversationType.direct,
            created_by=creator_id,
        )
        db.add(conv)
        await db.flush()

        db.add(ConversationMember(conversation_id=conv.id, user_id=creator_id, role=ConversationMemberRole.admin))
        db.add(ConversationMember(conversation_id=conv.id, user_id=other_user_id, role=ConversationMemberRole.member))
        await db.flush()

        result = await db.execute(
            select(Conversation)
            .options(
                selectinload(Conversation.members).selectinload(ConversationMember.user).selectinload(User.profile),
            )
            .where(Conversation.id == conv.id)
        )
        return result.scalar_one()

    async def create_group_conversation(
        self,
        creator_id: uuid.UUID,
        data: CreateConversationRequest,
        db: AsyncSession,
    ) -> Conversation:
        if data.type == ConversationType.direct and len(data.member_ids) != 1:
            raise BadRequestException(detail="Direct conversations require exactly one other member.")

        conv = Conversation(
            type=data.type,
            name=data.name.strip() if data.name else None,
            created_by=creator_id,
        )
        db.add(conv)
        await db.flush()

        all_ids = set(data.member_ids) | {creator_id}
        for uid in all_ids:
            db.add(ConversationMember(
                conversation_id=conv.id,
                user_id=uid,
                role=ConversationMemberRole.admin if uid == creator_id else ConversationMemberRole.member,
            ))
        await db.flush()

        result = await db.execute(
            select(Conversation)
            .options(
                selectinload(Conversation.members).selectinload(ConversationMember.user).selectinload(User.profile),
            )
            .where(Conversation.id == conv.id)
        )
        return result.scalar_one()

    async def get_user_conversations(
        self,
        user_id: uuid.UUID,
        db: AsyncSession,
    ) -> list[Conversation]:
        conv_ids_subq = (
            select(ConversationMember.conversation_id)
            .where(ConversationMember.user_id == user_id)
        ).subquery()

        result = await db.execute(
            select(Conversation)
            .options(
                selectinload(Conversation.members).selectinload(ConversationMember.user).selectinload(User.profile),
            )
            .where(Conversation.id.in_(select(conv_ids_subq)))
            .order_by(Conversation.updated_at.desc())
        )
        return list(result.scalars().all())

    async def get_conversation_messages(
        self,
        conversation_id: uuid.UUID,
        user_id: uuid.UUID,
        db: AsyncSession,
        cursor: str | None = None,
        limit: int = 50,
    ) -> tuple[list[Message], str | None, bool]:
        # Verify user is a member
        membership = await db.execute(
            select(ConversationMember).where(
                ConversationMember.conversation_id == conversation_id,
                ConversationMember.user_id == user_id,
            )
        )
        if membership.scalar_one_or_none() is None:
            raise NotFoundException(detail="Conversation not found.")

        query = (
            select(Message)
            .options(
                selectinload(Message.sender).selectinload(User.profile),
                selectinload(Message.reply_to).selectinload(Message.sender).selectinload(User.profile),
                selectinload(Message.reactions),
            )
            .where(
                Message.conversation_id == conversation_id,
                Message.deleted_at.is_(None),
            )
            .order_by(Message.created_at.desc(), Message.id.desc())
        )

        if cursor:
            try:
                cursor_dt = datetime.fromisoformat(cursor)
                query = query.where(Message.created_at < cursor_dt)
            except ValueError:
                pass

        query = query.limit(limit + 1)
        result = await db.execute(query)
        messages = list(result.scalars().all())

        has_more = len(messages) > limit
        if has_more:
            messages = messages[:limit]

        messages.reverse()
        next_cursor = messages[0].created_at.isoformat() if has_more and messages else None
        return messages, next_cursor, has_more

    async def send_message(
        self,
        conversation_id: uuid.UUID,
        sender_id: uuid.UUID,
        data: SendMessageRequest,
        db: AsyncSession,
    ) -> Message:
        membership = await db.execute(
            select(ConversationMember)
            .options(selectinload(ConversationMember.conversation))
            .where(
                ConversationMember.conversation_id == conversation_id,
                ConversationMember.user_id == sender_id,
            )
        )
        member = membership.scalar_one_or_none()
        if not member:
            raise NotFoundException(detail="Conversation not found.")

        # Check announcement restriction
        if member.conversation.type == ConversationType.announcement and member.role != ConversationMemberRole.admin:
            raise BadRequestException(detail="Only admins can post in announcement channels.")

        if not data.content and data.message_type == MessageType.text:
            raise BadRequestException(detail="Message content is required for text messages.")

        msg = Message(
            conversation_id=conversation_id,
            sender_id=sender_id,
            content=data.content.strip() if data.content else None,
            message_type=data.message_type,
            file_url=data.file_url.strip() if data.file_url else None,
            reply_to_message_id=data.reply_to_message_id,
        )
        db.add(msg)

        # Update conversation's updated_at
        await db.execute(
            update(Conversation)
            .where(Conversation.id == conversation_id)
            .values(updated_at=func.now())
        )
        await db.flush()

        result = await db.execute(
            select(Message)
            .options(
                selectinload(Message.sender).selectinload(User.profile),
                selectinload(Message.reply_to).selectinload(Message.sender).selectinload(User.profile),
                selectinload(Message.reactions),
            )
            .where(Message.id == msg.id)
        )
        return result.scalar_one()

    async def mark_conversation_read(
        self,
        conversation_id: uuid.UUID,
        user_id: uuid.UUID,
        db: AsyncSession,
    ) -> datetime:
        membership = await db.execute(
            select(ConversationMember).where(
                ConversationMember.conversation_id == conversation_id,
                ConversationMember.user_id == user_id,
            )
        )
        member = membership.scalar_one_or_none()
        if not member:
            raise NotFoundException(detail="Conversation not found.")
        member.last_read_at = datetime.now(timezone.utc)
        await db.flush()
        return member.last_read_at

    async def get_last_message(
        self,
        conversation_id: uuid.UUID,
        db: AsyncSession,
    ) -> Message | None:
        result = await db.execute(
            select(Message)
            .options(selectinload(Message.sender).selectinload(User.profile))
            .where(
                Message.conversation_id == conversation_id,
                Message.deleted_at.is_(None),
            )
            .order_by(Message.created_at.desc(), Message.id.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def get_unread_counts(
        self,
        user_id: uuid.UUID,
        db: AsyncSession,
    ) -> dict[str, int]:
        """Count unread (non-own, live) messages per conversation in ONE query.

        Previously this issued 1–2 ``COUNT`` queries *per conversation* a user
        belonged to — 100+ queries for someone in 50 group chats. We now join
        memberships to messages once and group by conversation.

        A message is "unread" if it was sent by someone else, is not deleted,
        and either the member has no ``last_read_at`` yet, or it was created
        after that timestamp.
        """
        is_unread = or_(
            ConversationMember.last_read_at.is_(None),
            Message.created_at > ConversationMember.last_read_at,
        )

        result = await db.execute(
            select(
                ConversationMember.conversation_id,
                func.count(Message.id).label("unread"),
            )
            .select_from(ConversationMember)
            .join(
                Message,
                and_(
                    Message.conversation_id == ConversationMember.conversation_id,
                    Message.sender_id != user_id,
                    Message.deleted_at.is_(None),
                    is_unread,
                ),
                isouter=True,
            )
            .where(ConversationMember.user_id == user_id)
            .group_by(ConversationMember.conversation_id)
        )

        conv_counts: dict[str, int] = {}
        total = 0
        for conv_id, unread in result.all():
            count = int(unread or 0)
            if count > 0:
                conv_counts[str(conv_id)] = count
                total += count

        return {"total": total, "conversations": conv_counts}

    async def edit_message(
        self,
        conversation_id: uuid.UUID,
        message_id: uuid.UUID,
        user_id: uuid.UUID,
        new_content: str,
        db: AsyncSession,
    ) -> Message:
        result = await db.execute(
            select(Message)
            .options(selectinload(Message.sender).selectinload(User.profile))
            .where(
                Message.id == message_id,
                Message.conversation_id == conversation_id,
                Message.deleted_at.is_(None),
            )
        )
        msg = result.scalar_one_or_none()
        if not msg:
            raise NotFoundException(detail="Message not found.")
        if str(msg.sender_id) != str(user_id):
            raise BadRequestException(detail="You can only edit your own messages.")
        if msg.message_type != MessageType.text:
            raise BadRequestException(detail="Only text messages can be edited.")
        msg.content = new_content.strip()
        msg.edited_at = datetime.now(timezone.utc)
        await db.flush()
        result2 = await db.execute(
            select(Message)
            .options(selectinload(Message.sender).selectinload(User.profile))
            .where(Message.id == msg.id)
        )
        return result2.scalar_one()

    async def delete_message(
        self,
        conversation_id: uuid.UUID,
        message_id: uuid.UUID,
        user_id: uuid.UUID,
        db: AsyncSession,
    ) -> None:
        result = await db.execute(
            select(Message).where(
                Message.id == message_id,
                Message.conversation_id == conversation_id,
                Message.deleted_at.is_(None),
            )
        )
        msg = result.scalar_one_or_none()
        if not msg:
            raise NotFoundException(detail="Message not found.")
        if str(msg.sender_id) != str(user_id):
            raise BadRequestException(detail="You can only delete your own messages.")
        msg.deleted_at = datetime.now(timezone.utc)
        await db.flush()

    async def toggle_reaction(
        self,
        conversation_id: uuid.UUID,
        message_id: uuid.UUID,
        user_id: uuid.UUID,
        emoji: str,
        db: AsyncSession,
    ) -> list[MessageReaction]:
        result = await db.execute(
            select(MessageReaction).where(
                MessageReaction.message_id == message_id,
                MessageReaction.user_id == user_id,
                MessageReaction.emoji == emoji,
            )
        )
        existing = result.scalar_one_or_none()
        if existing:
            await db.delete(existing)
            await db.flush()
        else:
            # Remove any existing reaction from this user on this message (one reaction per user)
            old_result = await db.execute(
                select(MessageReaction).where(
                    MessageReaction.message_id == message_id,
                    MessageReaction.user_id == user_id,
                )
            )
            for old in old_result.scalars().all():
                await db.delete(old)
            await db.flush()
            reaction = MessageReaction(
                message_id=message_id,
                user_id=user_id,
                emoji=emoji,
            )
            db.add(reaction)
            await db.flush()

        reactions_result = await db.execute(
            select(MessageReaction).where(MessageReaction.message_id == message_id)
        )
        return list(reactions_result.scalars().all())

    async def toggle_mute(
        self,
        conversation_id: uuid.UUID,
        user_id: uuid.UUID,
        db: AsyncSession,
    ) -> bool:
        membership = await db.execute(
            select(ConversationMember).where(
                ConversationMember.conversation_id == conversation_id,
                ConversationMember.user_id == user_id,
            )
        )
        member = membership.scalar_one_or_none()
        if not member:
            raise NotFoundException(detail="Conversation not found.")
        member.is_muted = not member.is_muted
        await db.flush()
        return member.is_muted

    async def search_messages(
        self,
        conversation_id: uuid.UUID,
        user_id: uuid.UUID,
        query: str,
        db: AsyncSession,
    ) -> list[Message]:
        membership = await db.execute(
            select(ConversationMember).where(
                ConversationMember.conversation_id == conversation_id,
                ConversationMember.user_id == user_id,
            )
        )
        if membership.scalar_one_or_none() is None:
            raise NotFoundException(detail="Conversation not found.")

        result = await db.execute(
            select(Message)
            .options(selectinload(Message.sender).selectinload(User.profile))
            .where(
                Message.conversation_id == conversation_id,
                Message.deleted_at.is_(None),
                Message.content.ilike(f"%{query}%"),
            )
            .order_by(Message.created_at.desc())
            .limit(50)
        )
        return list(result.scalars().all())


def get_messaging_service() -> MessagingService:
    return MessagingService()
