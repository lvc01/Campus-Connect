"""
Models package — imports all ORM models so Alembic and the app
can discover them via ``Base.metadata``.
"""

from app.core.database import Base  # noqa: F401

# Identity
from app.models.user import OTPCode, OTPPurpose, Profile, RefreshToken, User, UserRole, UserSettings  # noqa: F401

# Social feed
from app.models.post import Comment, Like, MediaType, PollOption, PollVote, Post, PostMedia, PostType, PostVisibility, Save  # noqa: F401

# Clubs
from app.models.club import Club, ClubCategory, ClubMember, ClubMemberRole  # noqa: F401

# Events
from app.models.event import Event, EventStatus, RSVP, RSVPStatus  # noqa: F401

# Academic
from app.models.academic import (  # noqa: F401
    Course,
    CourseMember,
    CourseMemberRole,
    Resource,
    ResourceType,
    StudyGroup,
    StudyGroupMember,
)

# Marketplace
from app.models.marketplace import (  # noqa: F401
    ListingCategory,
    ListingCondition,
    ListingImage,
    ListingStatus,
    MarketplaceListing,
    SellerRating,
)

# Messaging
from app.models.messaging import (  # noqa: F401
    Conversation,
    ConversationMember,
    ConversationMemberRole,
    ConversationType,
    Message,
    MessageType,
)

# Notifications
from app.models.notification import Notification, NotificationType  # noqa: F401

# Moderation
from app.models.moderation import (  # noqa: F401
    AppealStatus,
    ModerationAuditLog,
    Report,
    ReportAppeal,
    ReportCategory,
    ReportPriority,
    ReportStatus,
    ReportTargetType,
)

# Monetization
from app.models.monetization import Ad, AdStatus  # noqa: F401
