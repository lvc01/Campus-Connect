"""
CSRF protection middleware (double-submit cookie pattern).

The auth layer sets a non-httpOnly ``cc_csrf`` cookie that JavaScript can
read and echo back as the ``X-CSRF-Token`` request header.  This middleware
verifies that, for any state-changing request sent **with session cookies**,
the header value matches the cookie value.

Why "sent with session cookies" matters: pure bearer-token requests (the
mobile app, server-to-server) are not vulnerable to CSRF because a
cross-origin site cannot read the victim's bearer token to replay it.  We
therefore only enforce when a ``cc_access_token`` or ``cc_refresh_token``
cookie is present.  This keeps mobile/REST clients untouched while closing
the browser CSRF gap.

Safe methods (GET, HEAD, OPTIONS, TRACE) are exempt because they must not
mutate state.  ``POST /api/v1/auth/refresh`` reads the refresh token from a
SameSite=strict, path-scoped cookie and requires no JS-issued header, so it
is exempted explicitly.
"""

import logging

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)

# Methods that must never change server state and are safe to allow without CSRF.
_SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS", "TRACE"})

# Auth cookie names that, if present, indicate this is a browser session request
# and therefore subject to CSRF protection.
_SESSION_COOKIES = frozenset({"cc_access_token", "cc_refresh_token"})

# CSRF header name — must match the value sent by ``frontend/src/lib/api-client.ts``.
_CSRF_HEADER = "x-csrf-token"
_CSRF_COOKIE = "cc_csrf"

# The refresh endpoint is called with fetch (no X-CSRF-Token) from the axios
# interceptor; it relies on a path-scoped, SameSite=strict cookie rather than
# the double-submit token.  It must be exempt.
_CSRF_EXEMPT_PATHS = frozenset({"/api/v1/auth/refresh"})

# WebSocket upgrade is a GET and already exempt, but be explicit.
_CSRF_EXEMPT_PREFIXES = ("/ws",)


def _timing_safe_eq(a: str, b: str) -> bool:
    """Constant-time string comparison to avoid token-value timing oracles."""
    import hmac

    return hmac.compare_digest(a, b)


class CsrfMiddleware(BaseHTTPMiddleware):
    """Enforce the double-submit CSRF token on cookie-authed requests."""

    async def dispatch(self, request: Request, call_next):
        method = request.method.upper()

        # 1. Safe methods never need CSRF protection.
        if method in _SAFE_METHODS:
            return await call_next(request)

        # 2. Only browser session requests (carrying auth cookies) are subject.
        #    Bearer-token clients (mobile, API) can't be CSRF'd.
        has_session_cookie = any(
            request.cookies.get(name) for name in _SESSION_COOKIES
        )
        if not has_session_cookie:
            return await call_next(request)

        # 3. Explicit exemptions (refresh reads a scoped cookie; ws is a GET).
        path = request.url.path.rstrip("/") or "/"
        if path in _CSRF_EXEMPT_PATHS or path.startswith(_CSRF_EXEMPT_PREFIXES):
            return await call_next(request)

        # 4. Validate header vs cookie.
        cookie_token = request.cookies.get(_CSRF_COOKIE, "")
        header_token = request.headers.get(_CSRF_HEADER, "")

        if not cookie_token or not header_token or not _timing_safe_eq(
            header_token, cookie_token
        ):
            logger.warning(
                "CSRF validation failed for %s %s (has_cookie=%s has_header=%s)",
                method,
                path,
                bool(cookie_token),
                bool(header_token),
            )
            return JSONResponse(
                status_code=403,
                content={
                    "detail": "CSRF token missing or invalid.",
                    "error_code": "CSRF_FAILED",
                },
            )

        return await call_next(request)
