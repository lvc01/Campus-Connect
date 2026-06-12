"""
SQLAlchemy ORM models — MarketplaceListing, ListingImage, SellerRating.

The marketplace enables verified students to buy/sell textbooks,
sublet accommodation, and offer tutoring services. No payment
processing in MVP — transactions happen via in-app DM.
"""

import enum
import uuid

from sqlalchemy import (
    CheckConstraint,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, SoftDeleteMixin, TimestampMixin


# ── Enums ─────────────────────────────────────────────────────────────

class ListingCategory(str, enum.Enum):
    """Category of a marketplace listing."""

    textbook = "textbook"
    accommodation = "accommodation"
    tutoring = "tutoring"
    electronics = "electronics"
    other = "other"


class ListingCondition(str, enum.Enum):
    """Physical condition of the listed item."""

    new = "new"
    like_new = "like_new"
    good = "good"
    fair = "fair"
    poor = "poor"


class ListingStatus(str, enum.Enum):
    """Current transaction status of a listing."""

    active = "active"
    sold = "sold"
    reserved = "reserved"
    expired = "expired"


# ── Marketplace Listing ──────────────────────────────────────────────

class MarketplaceListing(Base, TimestampMixin, SoftDeleteMixin):
    """
    A product or service listing in the student marketplace.

    Listings include a ``transaction_fee`` placeholder for future
    payment integration.
    """

    __tablename__ = "marketplace_listings"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    seller_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    category: Mapped[ListingCategory] = mapped_column(
        SAEnum(ListingCategory, name="listing_category", create_constraint=True),
        nullable=False,
    )
    condition: Mapped[ListingCondition | None] = mapped_column(
        SAEnum(ListingCondition, name="listing_condition", create_constraint=True),
        nullable=True,
    )
    status: Mapped[ListingStatus] = mapped_column(
        SAEnum(ListingStatus, name="listing_status", create_constraint=True),
        default=ListingStatus.active,
    )
    transaction_fee: Mapped[float | None] = mapped_column(
        Numeric(10, 2), nullable=True,
    )
    view_count: Mapped[int] = mapped_column(Integer, default=0)

    # ── Relationships ─────────────────────────────────────────────────
    seller: Mapped["User"] = relationship(back_populates="marketplace_listings")  # type: ignore[name-defined]
    images: Mapped[list["ListingImage"]] = relationship(
        back_populates="listing", lazy="selectin", cascade="all, delete-orphan",
    )
    ratings: Mapped[list["SellerRating"]] = relationship(
        back_populates="listing", lazy="noload",
    )
    saves: Mapped[list["ListingSave"]] = relationship(
        back_populates="listing", lazy="noload", cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<MarketplaceListing id={self.id} title={self.title!r} status={self.status.value}>"


# ── Listing Image ────────────────────────────────────────────────────

class ListingImage(Base, TimestampMixin):
    """An image attached to a marketplace listing."""

    __tablename__ = "listing_images"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    listing_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("marketplace_listings.id", ondelete="CASCADE"), nullable=False,
    )
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    order: Mapped[int] = mapped_column(Integer, default=0)

    # ── Relationships ─────────────────────────────────────────────────
    listing: Mapped["MarketplaceListing"] = relationship(back_populates="images")

    def __repr__(self) -> str:
        return f"<ListingImage id={self.id} order={self.order}>"


# ── Seller Rating ────────────────────────────────────────────────────

class SellerRating(Base, TimestampMixin):
    """
    Post-transaction rating left by a buyer for a seller.

    Ratings are 1–5 stars with an optional text review.
    One rating per buyer per listing is enforced.
    """

    __tablename__ = "seller_ratings"
    __table_args__ = (
        UniqueConstraint("buyer_id", "listing_id", name="uq_rating_buyer_listing"),
        CheckConstraint("rating >= 1 AND rating <= 5", name="ck_rating_range"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    seller_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )
    buyer_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )
    listing_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("marketplace_listings.id", ondelete="CASCADE"), nullable=False,
    )
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    review: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Relationships ─────────────────────────────────────────────────
    seller: Mapped["User"] = relationship(  # type: ignore[name-defined]
        back_populates="seller_ratings_received", foreign_keys=[seller_id],
    )
    buyer: Mapped["User"] = relationship(  # type: ignore[name-defined]
        back_populates="seller_ratings_given", foreign_keys=[buyer_id],
    )
    listing: Mapped["MarketplaceListing"] = relationship(back_populates="ratings")

    def __repr__(self) -> str:
        return f"<SellerRating id={self.id} rating={self.rating}>"


# ── Listing Save (Bookmark) ──────────────────────────────────────────

class ListingSave(Base, TimestampMixin):
    """A bookmarked marketplace listing — lets users save listings for later."""

    __tablename__ = "listing_saves"
    __table_args__ = (
        UniqueConstraint("user_id", "listing_id", name="uq_listing_save_user_listing"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )
    listing_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("marketplace_listings.id", ondelete="CASCADE"), nullable=False,
    )

    user: Mapped["User"] = relationship(back_populates="listing_saves")  # type: ignore[name-defined]
    listing: Mapped["MarketplaceListing"] = relationship(back_populates="saves")

    def __repr__(self) -> str:
        return f"<ListingSave id={self.id} user={self.user_id} listing={self.listing_id}>"
