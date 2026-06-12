import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin


class AdStatus(str, enum.Enum):
    active = "active"
    paused = "paused"
    expired = "expired"


class Ad(Base, TimestampMixin):
    __tablename__ = "ads"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    advertiser_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    boosted_post_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("posts.id", ondelete="SET NULL"), nullable=True,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    target_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[AdStatus] = mapped_column(
        SAEnum(AdStatus, name="ad_status", create_constraint=True),
        default=AdStatus.active,
    )
    daily_budget: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_budget: Mapped[int | None] = mapped_column(Integer, nullable=True)
    target_faculty: Mapped[str | None] = mapped_column(String(100), nullable=True)
    impression_count: Mapped[int] = mapped_column(Integer, default=0)
    click_count: Mapped[int] = mapped_column(Integer, default=0)
    start_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    end_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )

    advertiser: Mapped["User"] = relationship(foreign_keys=[advertiser_id])  # type: ignore[name-defined]
    boosted_post: Mapped["Post | None"] = relationship(foreign_keys=[boosted_post_id])  # type: ignore[name-defined]

    def __repr__(self) -> str:
        return f"<Ad id={self.id} title={self.title!r} status={self.status.value}>"
