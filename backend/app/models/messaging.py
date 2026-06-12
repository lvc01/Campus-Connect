"""
SQLAlchemy ORM models — Conversation, ConversationMember, Message.

Messaging supports direct 1-to-1 chats, group chats (study groups,
club committees), and announcement-only channels where only admins
can post and members read.
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, SoftDeleteMixin, TimestampMixin


# ── Enums ─────────────────────────────────────────────────────────────

class ConversationType(str, enum.Enum):
    """Type of conversation thread."""

    direct = "direct"
    group = "group"
    announcement = "announcement"


class ConversationMemberRole(str, enum.Enum):
    """Permission level within a conversation."""

    member = "member"
    admin = "admin"


class MessageType(str, enum.Enum):
    """Content type of a message."""

    text = "text"
    image = "image"
    file = "file"
    system = "system"


# ── Conversation ──────────────────────────────────────────────────────

class Conversation(Base, TimestampMixin):
    """
    A conversation thread (DM, group chat, or announcement channel).

    Announcement conversations restrict posting to admin members only.
    """

    __tablename__ = "conversations"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    type: Mapped[ConversationType] = mapped_column(
        SAEnum(ConversationType, name="conversation_type", create_constraint=True),
        nullable=False,
    )
    name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )

    # ── Relationships ─────────────────────────────────────────────────
    members: Mapped[list["ConversationMember"]] = relationship(
        back_populates="conversation", lazy="selectin", cascade="all, delete-orphan",
    )
    messages: Mapped[list["Message"]] = relationship(
        back_populates="conversation", lazy="noload", cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Conversation id={self.id} type={self.type.value}>"


# ── Conversation Member ──────────────────────────────────────────────

class ConversationMember(Base, TimestampMixin):
    """
    Junction table linking users to conversations.

    Tracks per-member read position and mute status.
    """

    __tablename__ = "conversation_members"
    __table_args__ = (
        UniqueConstraint("conversation_id", "user_id", name="uq_conversation_member"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )
    role: Mapped[ConversationMemberRole] = mapped_column(
        SAEnum(ConversationMemberRole, name="conversation_member_role", create_constraint=True),
        default=ConversationMemberRole.member,
    )
    last_read_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    is_muted: Mapped[bool] = mapped_column(Boolean, default=False)

    # ── Relationships ─────────────────────────────────────────────────
    conversation: Mapped["Conversation"] = relationship(back_populates="members")
    user: Mapped["User"] = relationship(back_populates="conversation_memberships")  # type: ignore[name-defined]

    def __repr__(self) -> str:
        return f"<ConversationMember conv={self.conversation_id} user={self.user_id}>"


# ── Message ───────────────────────────────────────────────────────────

class Message(Base, TimestampMixin, SoftDeleteMixin):
    """
    A single message within a conversation.

    Messages are soft-deleted so that conversation history is preserved
    even when individual messages are removed.
    """

    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    sender_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    message_type: Mapped[MessageType] = mapped_column(
        SAEnum(MessageType, name="message_type", create_constraint=True),
        default=MessageType.text,
    )
    file_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    edited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # ── Relationships ─────────────────────────────────────────────────
    conversation: Mapped["Conversation"] = relationship(back_populates="messages")
    sender: Mapped["User"] = relationship(back_populates="sent_messages")  # type: ignore[name-defined]
    reactions: Mapped[list["MessageReaction"]] = relationship(
        back_populates="message", lazy="selectin", cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Message id={self.id} type={self.message_type.value}>"


# ── Message Reaction ────────────────────────────────────────────────

class MessageReaction(Base, TimestampMixin):
    """An emoji reaction on a message."""

    __tablename__ = "message_reactions"
    __table_args__ = (
        UniqueConstraint("message_id", "user_id", "emoji", name="uq_message_reaction"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    message_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("messages.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )
    emoji: Mapped[str] = mapped_column(String(10), nullable=False)

    # ── Relationships ─────────────────────────────────────────────────
    message: Mapped["Message"] = relationship(back_populates="reactions")

    def __repr__(self) -> str:
        return f"<MessageReaction msg={self.message_id} emoji={self.emoji}>"
