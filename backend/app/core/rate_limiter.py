"""
Redis-backed rate limiter for endpoints.

Tracks request timestamps per (IP + path) key using fastapi-limiter.
If Redis is unavailable (REDIS_ENABLED=false at startup), rate limiting
becomes a no-op dependency and never blocks requests.

The Redis availability check happens at **request time** inside the
returned async dependency, not at import time.  This avoids the
init-order bug where FastAPILimiter.redis is still ``None`` when
FastAPI first resolves dependencies before the lifespan event fires.
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


def rate_limit(
    max_requests: int = 10,
    window_seconds: int = 60,
    key_builder: Callable[[Request], str] | None = None,
) -> Callable:
    """
    FastAPI dependency callable that enforces a rate limit using Redis.

    The check for ``FastAPILimiter.redis is None`` is performed **inside**
    the returned async dependency so it executes at request time, not at
    import / dependency-resolution time.  This guarantees that the
    lifespan event has already initialized the Redis connection before
    we decide whether to enforce rate limiting.

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
    limiter = RateLimiter(
        times=max_requests,
        seconds=window_seconds,
        callback=_custom_callback,
    )

    async def _check(request: Request, response: Response) -> None:
        if FastAPILimiter.redis is None:
            return
        await limiter(request, response)

    _check.__rate_limit_params__ = {
        "max_requests": max_requests,
        "window_seconds": window_seconds,
    }
    return _check
