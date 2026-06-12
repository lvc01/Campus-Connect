"""
Common Pydantic schemas used across multiple API endpoints.

Provides standardised pagination, message responses, and error formats
so every endpoint returns a consistent JSON structure.
"""

from pydantic import BaseModel, Field


class CursorPaginationParams(BaseModel):
    """Query parameters for cursor-based pagination."""

    cursor: str | None = Field(
        default=None,
        description="Opaque cursor pointing to the last item of the previous page.",
    )
    limit: int = Field(
        default=20,
        ge=1,
        le=100,
        description="Maximum number of items to return (1–100).",
    )


class PaginatedResponse(BaseModel):
    """Envelope for paginated list endpoints."""

    items: list = Field(description="Page of results.")
    next_cursor: str | None = Field(
        default=None, description="Cursor for the next page, or null if this is the last."
    )
    has_more: bool = Field(description="Whether more pages exist.")
    total: int | None = Field(
        default=None, description="Total count (omitted when expensive to compute)."
    )


class MessageResponse(BaseModel):
    """Simple success / info message."""

    message: str
    dev_otp: str | None = None


class ErrorResponse(BaseModel):
    """Structured error payload returned by exception handlers."""

    detail: str
    error_code: str | None = None
