"""
Redis-backed rate limiter for endpoints.

Tracks request timestamps per (IP + path) key using fastapi-limiter.
If Redis is unavailable (REDIS_ENABLED=false at startup), rate limiting
becomes a no-op dependency and never blocks requests.
"""

from collections.abc import Callable
from fastapi import Request, Response
from fastapi_limiter.depends import RateLimiter
from fastapi_limiter import FastAPILimiter

from app.core.exceptions import RateLimitException


async def _custom_callback(request: Request, response: Response, pexpire: int) -> None:
    """Callback for when a rate limit is exceeded."""
    raise RateLimitException(
        detail="Too many requests. Please try again later.",
        error_code="RATE_LIMITED",
    )


async def _noop() -> None:
    """No-op dependency used when rate limiting is disabled (no Redis)."""
    return None


def rate_limit(
    max_requests: int = 10,
    window_seconds: int = 60,
    key_builder: Callable[[Request], str] | None = None,
) -> Callable:
    """
    FastAPI dependency callable that enforces a rate limit using Redis.

    If FastAPILimiter was not initialised at startup (no Redis available),
    returns a no-op dependency instead. This lets route signatures stay
    the same in dev and prod.

    Parameters
    ----------
    max_requests:
        Maximum number of requests allowed within the window.
    window_seconds:
        Length of the sliding window in seconds.
    key_builder:
        Optional callable that receives the :class:`Request` and returns a
        unique key string.
    """
    if FastAPILimiter.redis is None:
        return _noop

    return RateLimiter(
        times=max_requests,
        seconds=window_seconds,
        callback=_custom_callback,
    )
