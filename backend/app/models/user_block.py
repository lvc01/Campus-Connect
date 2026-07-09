"""
User block model — allows users to block other users.

Blocked users cannot:
- See the blocker's posts in their feed
- Send messages to the blocker
- See the blocker's profile details
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin


class UserBlock(Base, TimestampMixin):
    """Records a block relationship between two users."""

    __tablename__ = "user_blocks"
    __table_args__ = (
        UniqueConstraint("blocker_id", "blocked_id", name="uq_user_block"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    blocker_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    blocked_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )

    # ── Relationships ─────────────────────────────────────────────────
    blocker: Mapped["User"] = relationship(foreign_keys=[blocker_id], lazy="noload")
    blocked: Mapped["User"] = relationship(foreign_keys=[blocked_id], lazy="noload")

    def __repr__(self) -> str:
        return f"<UserBlock blocker={self.blocker_id} blocked={self.blocked_id}>"
