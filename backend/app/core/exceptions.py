"""
Custom application exceptions and FastAPI exception handlers.

Every exception carries an HTTP status code and a machine-readable
``error_code`` so the frontend can branch on structured errors
instead of parsing message strings.
"""

from fastapi import Request
from fastapi.responses import JSONResponse


class AppException(Exception):
    """Base exception for all application-level errors."""

    def __init__(
        self,
        status_code: int = 500,
        detail: str = "An unexpected error occurred.",
        error_code: str = "INTERNAL_ERROR",
        headers: dict[str, str] | None = None,
    ) -> None:
        self.status_code = status_code
        self.detail = detail
        self.error_code = error_code
        self.headers = headers
        super().__init__(detail)


class BadRequestException(AppException):
    """400 — the request is malformed or violates a business rule."""

    def __init__(self, detail: str = "Bad request.", error_code: str = "BAD_REQUEST") -> None:
        super().__init__(status_code=400, detail=detail, error_code=error_code)


class UnauthorizedException(AppException):
    """401 — missing or invalid credentials."""

    def __init__(self, detail: str = "Could not validate credentials.", error_code: str = "UNAUTHORIZED") -> None:
        super().__init__(
            status_code=401,
            detail=detail,
            error_code=error_code,
            headers={"WWW-Authenticate": "Bearer"},
        )


class ForbiddenException(AppException):
    """403 — authenticated but insufficient permissions."""

    def __init__(self, detail: str = "You do not have permission to perform this action.", error_code: str = "FORBIDDEN") -> None:
        super().__init__(status_code=403, detail=detail, error_code=error_code)


class NotFoundException(AppException):
    """404 — requested resource does not exist."""

    def __init__(self, detail: str = "Resource not found.", error_code: str = "NOT_FOUND") -> None:
        super().__init__(status_code=404, detail=detail, error_code=error_code)


class ConflictException(AppException):
    """409 — the request conflicts with current state (e.g. duplicate email)."""

    def __init__(self, detail: str = "Resource already exists.", error_code: str = "CONFLICT") -> None:
        super().__init__(status_code=409, detail=detail, error_code=error_code)


class RateLimitException(AppException):
    """429 — too many requests."""

    def __init__(self, detail: str = "Too many requests. Please try again later.", error_code: str = "RATE_LIMITED") -> None:
        super().__init__(status_code=429, detail=detail, error_code=error_code)


# ── FastAPI exception handler ─────────────────────────────────────────

async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    """Convert ``AppException`` subclasses into structured JSON responses."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.detail,
            "error_code": exc.error_code,
        },
        headers=exc.headers,
    )
