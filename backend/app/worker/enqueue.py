"""
Job queue helper — thin wrapper around arq for enqueuing background jobs.

Falls back to direct execution if Redis is unavailable (single-worker dev).
"""

import asyncio
import logging
from typing import Any

from arq import create_pool
from arq.connections import RedisSettings

from app.config import get_settings

logger = logging.getLogger(__name__)

_queue = None


async def get_queue():
    """Return (or create) the ARQ Redis queue."""
    global _queue
    settings = get_settings()
    if not settings.REDIS_ENABLED:
        return None
    if _queue is None:
        try:
            _queue = await create_pool(
                RedisSettings.from_dsn(settings.REDIS_URL)
            )
        except Exception as e:
            logger.warning("Failed to connect to ARQ Redis queue: %s", e)
            return None
    return _queue


async def enqueue_job(
    job_name: str,
    *args: Any,
    _job_timeout: int = 30,
    **kwargs: Any,
) -> None:
    """Enqueue a background job by name.

    If Redis is unavailable, logs a warning and skips (dev fallback).
    """
    queue = await get_queue()
    if queue is None:
        logger.warning(
            "ARQ queue unavailable — job '%s' not enqueued (dev fallback). "
            "Install and run an ARQ worker for production.",
            job_name,
        )
        return
    try:
        await queue.enqueue_job(
            job_name,
            *args,
            _job_timeout=_job_timeout,
            **kwargs,
        )
        logger.info("Enqueued job '%s'", job_name)
    except Exception as e:
        logger.error("Failed to enqueue job '%s': %s", job_name, e)
