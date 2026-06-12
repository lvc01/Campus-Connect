"""
API v1 router — aggregates all v1 endpoint routers.

Each domain module exposes its own ``router``, which is included
here under the ``/api/v1`` prefix so the main app only needs to
mount a single router.
"""

from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.users import router as users_router
from app.api.v1.posts import router as posts_router
from app.api.v1.clubs import router as clubs_router
from app.api.v1.events import router as events_router
from app.api.v1.academics import router as academics_router
from app.api.v1.marketplace import router as marketplace_router
from app.api.v1.messaging import router as messaging_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.moderation import router as moderation_router
from app.api.v1.monetization import router as monetization_router
from app.api.v1.search import router as search_router
from app.api.v1.admin import router as admin_router

api_v1_router = APIRouter(prefix="/api/v1")

api_v1_router.include_router(auth_router)
api_v1_router.include_router(users_router)
api_v1_router.include_router(posts_router)
api_v1_router.include_router(clubs_router)
api_v1_router.include_router(events_router)
api_v1_router.include_router(academics_router)
api_v1_router.include_router(marketplace_router)
api_v1_router.include_router(messaging_router)
api_v1_router.include_router(notifications_router)
api_v1_router.include_router(moderation_router)
api_v1_router.include_router(monetization_router)
api_v1_router.include_router(search_router)
api_v1_router.include_router(admin_router)
