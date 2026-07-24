"""
Meilisearch service — provides full-text search across users, posts, clubs,
events, and marketplace listings.

Falls back to ILIKE-based SQL search when Meilisearch is unavailable.

Uses ``meilisearch_python-sdk`` (v3+). The sync client is used here because
index configuration and document upserts are called from background jobs
and startup hooks where async is unnecessary.
"""

import logging
from typing import Any

from meilisearch_python_sdk import Client as MeiliClient

from app.config import get_settings

logger = logging.getLogger(__name__)

_client: MeiliClient | None = None


def get_meilisearch_client() -> MeiliClient | None:
    """Return a Meilisearch client, or None if not configured."""
    global _client
    settings = get_settings()
    if not settings.MEILI_HOST:
        return None
    if _client is None:
        try:
            _client = MeiliClient(
                url=settings.MEILI_HOST,
                api_key=settings.MEILI_API_KEY or None,
            )
            _client.health()
        except Exception as e:
            logger.warning("Meilisearch unavailable: %s", e)
            _client = None
    return _client


# ── Index names ────────────────────────────────────────────────────────
INDEX_USERS = "users"
INDEX_POSTS = "posts"
INDEX_CLUBS = "clubs"
INDEX_EVENTS = "events"
INDEX_LISTINGS = "listings"

ALL_INDEXES = [INDEX_USERS, INDEX_POSTS, INDEX_CLUBS, INDEX_EVENTS, INDEX_LISTINGS]


def _configure_index(client: MeiliClient, index_uid: str) -> None:
    """Set up ranking rules and searchable/filterable attributes for an index."""
    index = client.index(index_uid)

    if index_uid == INDEX_USERS:
        index.update_settings({
            "searchableAttributes": ["display_name", "email", "faculty"],
            "filterableAttributes": ["faculty", "year_of_study"],
            "rankingWords": ["display_name", "email"],
        })
    elif index_uid == INDEX_POSTS:
        index.update_settings({
            "searchableAttributes": ["content", "author_name"],
            "filterableAttributes": ["author_id"],
            "rankingWords": ["content"],
        })
    elif index_uid == INDEX_CLUBS:
        index.update_settings({
            "searchableAttributes": ["name", "description"],
            "filterableAttributes": ["is_approved", "is_premium"],
            "rankingWords": ["name"],
        })
    elif index_uid == INDEX_EVENTS:
        index.update_settings({
            "searchableAttributes": ["title", "description", "location"],
            "filterableAttributes": ["status"],
            "rankingWords": ["title"],
        })
    elif index_uid == INDEX_LISTINGS:
        index.update_settings({
            "searchableAttributes": ["title", "description", "category"],
            "filterableAttributes": ["status", "category"],
            "rankingWords": ["title"],
        })


def ensure_indexes(client: MeiliClient) -> None:
    """Create indexes if they don't exist and configure them."""
    existing_indexes = client.get_indexes() or []
    existing = {idx.uid for idx in existing_indexes}
    for uid in ALL_INDEXES:
        if uid not in existing:
            client.create_index(uid, primary_key="id")
            _configure_index(client, uid)
            logger.info("Created Meilisearch index: %s", uid)
