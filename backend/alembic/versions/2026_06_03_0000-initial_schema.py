"""
Initial schema — creates all application tables.

Uses ``Base.metadata.create_all`` / ``drop_all`` so the migration
stays in sync with the ORM model definitions. Once this baseline
migration is applied, subsequent changes should use
``alembic revision --autogenerate`` for granular per-change scripts.
"""

import logging
from typing import Sequence, Union

from alembic import op

from app.core.database import Base
from app.models import (  # noqa: F401 — registers all models on Base.metadata
    OTPCode,
    OTPPurpose,
    Profile,
    RefreshToken,
    User,
    UserRole,
    Comment,
    Like,
    MediaType,
    Post,
    PostMedia,
    PostType,
    PostVisibility,
    Save,
    Club,
    ClubCategory,
    ClubMember,
    ClubMemberRole,
    Event,
    EventStatus,
    RSVP,
    RSVPStatus,
    Course,
    CourseMember,
    CourseMemberRole,
    Resource,
    ResourceType,
    StudyGroup,
    StudyGroupMember,
    ListingCategory,
    ListingCondition,
    ListingImage,
    ListingStatus,
    MarketplaceListing,
    SellerRating,
    Conversation,
    ConversationMember,
    ConversationMemberRole,
    ConversationType,
    Message,
    MessageType,
    Notification,
    NotificationType,
    Report,
    ReportCategory,
    ReportStatus,
    ReportTargetType,
    Ad,
    AdStatus,
)

logger = logging.getLogger(__name__)
revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)
    logger.info("Initial schema created.")


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
    logger.info("Initial schema dropped.")
