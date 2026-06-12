"""
SQLAlchemy ORM models — Post, PostMedia, Comment, Like, Save.

The social feed is the heart of the platform. Posts support rich media,
threaded comments, likes, and bookmarks (saves). Denormalized counters
(like_count, comment_count) keep feed queries fast.
"""

import enum
import uuid

from sqlalchemy import (
    Boolean,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from app.core.types import PortableARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, SoftDeleteMixin, TimestampMixin


# ── Enums ─────────────────────────────────────────────────────────────

class PostType(str, enum.Enum):
    """Content type of a post."""

    text = "text"
    image = "image"
    video = "video"
    poll = "poll"
    link = "link"


class PostVisibility(str, enum.Enum):
    """Who can see the post in their feed."""

    public = "public"
    faculty_only = "faculty_only"
    club_only = "club_only"


class MediaType(str, enum.Enum):
    """Type of attached media file."""

    image = "image"
    video = "video"
    document = "document"


# ── Post ──────────────────────────────────────────────────────────────

class Post(Base, TimestampMixin, SoftDeleteMixin):
    """
    A user-created post in the main feed or a club page.

    Posts may carry multiple media attachments, be tagged for discovery,
    and are soft-deleted to preserve discussion threads.
    """

    __tablename__ = "posts"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    author_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    post_type: Mapped[PostType] = mapped_column(
        SAEnum(PostType, name="post_type", create_constraint=True),
        default=PostType.text,
    )
    visibility: Mapped[PostVisibility] = mapped_column(
        SAEnum(PostVisibility, name="post_visibility", create_constraint=True),
        default=PostVisibility.public,
    )
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    is_promoted: Mapped[bool] = mapped_column(Boolean, default=False)
    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False)
    like_count: Mapped[int] = mapped_column(Integer, default=0)
    comment_count: Mapped[int] = mapped_column(Integer, default=0)
    share_count: Mapped[int] = mapped_column(Integer, default=0)
    tags: Mapped[list[str] | None] = mapped_column(
        PortableARRAY, nullable=True,
    )
    club_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("clubs.id", ondelete="SET NULL"), nullable=True,
    )

    # ── Relationships ─────────────────────────────────────────────────
    author: Mapped["User"] = relationship(back_populates="posts")  # type: ignore[name-defined]
    media: Mapped[list["PostMedia"]] = relationship(
        back_populates="post", lazy="selectin", cascade="all, delete-orphan",
    )
    comments: Mapped[list["Comment"]] = relationship(
        back_populates="post", lazy="noload", cascade="all, delete-orphan",
    )
    likes: Mapped[list["Like"]] = relationship(
        back_populates="post", lazy="noload", cascade="all, delete-orphan",
    )
    saves: Mapped[list["Save"]] = relationship(
        back_populates="post", lazy="noload", cascade="all, delete-orphan",
    )
    shares: Mapped[list["Share"]] = relationship(
        back_populates="post", lazy="noload", cascade="all, delete-orphan",
    )
    poll_options: Mapped[list["PollOption"]] = relationship(
        back_populates="post", lazy="selectin", cascade="all, delete-orphan",
    )
    club: Mapped["Club | None"] = relationship(back_populates="posts")  # type: ignore[name-defined]

    def __repr__(self) -> str:
        return f"<Post id={self.id} type={self.post_type.value}>"


# ── Post Media ────────────────────────────────────────────────────────

class PostMedia(Base, TimestampMixin):
    """An individual media attachment belonging to a post."""

    __tablename__ = "post_media"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    post_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("posts.id", ondelete="CASCADE"), nullable=False,
    )
    media_type: Mapped[MediaType] = mapped_column(
        SAEnum(MediaType, name="media_type", create_constraint=True),
        nullable=False,
    )
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    thumbnail_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    order: Mapped[int] = mapped_column(Integer, default=0)

    # ── Relationships ─────────────────────────────────────────────────
    post: Mapped["Post"] = relationship(back_populates="media")

    def __repr__(self) -> str:
        return f"<PostMedia id={self.id} type={self.media_type.value}>"


# ── Comment ───────────────────────────────────────────────────────────

class Comment(Base, TimestampMixin, SoftDeleteMixin):
    """
    A comment on a post, optionally threaded via ``parent_id``.

    Top-level comments have ``parent_id = None``. Replies reference
    their parent comment, enabling nested discussion threads.
    """

    __tablename__ = "comments"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    post_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("comments.id", ondelete="CASCADE"), nullable=True,
    )
    like_count: Mapped[int] = mapped_column(Integer, default=0)

    # ── Relationships ─────────────────────────────────────────────────
    post: Mapped["Post"] = relationship(back_populates="comments")
    author: Mapped["User"] = relationship(back_populates="comments")  # type: ignore[name-defined]
    parent: Mapped["Comment | None"] = relationship(
        back_populates="replies", remote_side="Comment.id",
    )
    replies: Mapped[list["Comment"]] = relationship(
        back_populates="parent", lazy="noload",
    )

    def __repr__(self) -> str:
        return f"<Comment id={self.id} post={self.post_id}>"


# ── Like ──────────────────────────────────────────────────────────────

class Like(Base, TimestampMixin):
    """
    A like on a post or comment (polymorphic via nullable FKs).

    Unique constraints prevent a user from liking the same target twice.
    """

    __tablename__ = "likes"
    __table_args__ = (
        UniqueConstraint("user_id", "post_id", name="uq_like_user_post"),
        UniqueConstraint("user_id", "comment_id", name="uq_like_user_comment"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )
    post_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("posts.id", ondelete="CASCADE"), nullable=True,
    )
    comment_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("comments.id", ondelete="CASCADE"), nullable=True,
    )

    # ── Relationships ─────────────────────────────────────────────────
    user: Mapped["User"] = relationship(back_populates="likes")  # type: ignore[name-defined]
    post: Mapped["Post | None"] = relationship(back_populates="likes")

    def __repr__(self) -> str:
        return f"<Like id={self.id} user={self.user_id}>"


# ── Save (Bookmark) ──────────────────────────────────────────────────

class Save(Base, TimestampMixin):
    """A bookmarked post — lets users save posts for later reading."""

    __tablename__ = "saves"
    __table_args__ = (
        UniqueConstraint("user_id", "post_id", name="uq_save_user_post"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )
    post_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("posts.id", ondelete="CASCADE"), nullable=False,
    )

    # ── Relationships ─────────────────────────────────────────────────
    user: Mapped["User"] = relationship(back_populates="saves")  # type: ignore[name-defined]
    post: Mapped["Post"] = relationship(back_populates="saves")

    def __repr__(self) -> str:
        return f"<Save id={self.id} user={self.user_id} post={self.post_id}>"


# ── Share (Repost) ─────────────────────────────────────────────────

class Share(Base, TimestampMixin):
    """A share/repost — tracks which users have shared a post."""

    __tablename__ = "shares"
    __table_args__ = (
        UniqueConstraint("user_id", "post_id", name="uq_share_user_post"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )
    post_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("posts.id", ondelete="CASCADE"), nullable=False,
    )

    # ── Relationships ─────────────────────────────────────────────────
    user: Mapped["User"] = relationship(back_populates="shares")  # type: ignore[name-defined]
    post: Mapped["Post"] = relationship(back_populates="shares")

    def __repr__(self) -> str:
        return f"<Share id={self.id} user={self.user_id} post={self.post_id}>"


# ── Poll ────────────────────────────────────────────────────────────

class PollOption(Base, TimestampMixin):
    """A single option in a poll post."""

    __tablename__ = "poll_options"
    __table_args__ = (
        UniqueConstraint("post_id", "position", name="uq_poll_option_position"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    post_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    text: Mapped[str] = mapped_column(String(200), nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    vote_count: Mapped[int] = mapped_column(Integer, default=0)

    # ── Relationships ─────────────────────────────────────────────────
    post: Mapped["Post"] = relationship(back_populates="poll_options")
    votes: Mapped[list["PollVote"]] = relationship(
        back_populates="option", lazy="noload", cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<PollOption id={self.id} text={self.text!r} votes={self.vote_count}>"


class PollVote(Base, TimestampMixin):
    """A user's vote on a poll option. One vote per user per poll post."""

    __tablename__ = "poll_votes"
    __table_args__ = (
        UniqueConstraint("user_id", "post_id", name="uq_poll_vote_user_post"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )
    post_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    option_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("poll_options.id", ondelete="CASCADE"), nullable=False,
    )

    # ── Relationships ─────────────────────────────────────────────────
    user: Mapped["User"] = relationship(back_populates="poll_votes")  # type: ignore[name-defined]
    post: Mapped["Post"] = relationship()
    option: Mapped["PollOption"] = relationship(back_populates="votes")

    def __repr__(self) -> str:
        return f"<PollVote id={self.id} user={self.user_id} option={self.option_id}>"
