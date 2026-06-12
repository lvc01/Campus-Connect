"""
Cursor-based pagination utilities.

Cursor pagination is used instead of offset pagination for better
performance with large datasets — it avoids the ``OFFSET`` scan
and produces stable pages even when new rows are inserted.
"""

import base64
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, select
from sqlalchemy.ext.asyncio import AsyncSession


def encode_cursor(value: Any) -> str:
    """Encode a value (typically a UUID or timestamp string) into a base64 cursor."""
    return base64.urlsafe_b64encode(str(value).encode()).decode()


def decode_cursor(cursor: str) -> str:
    """Decode a base64 cursor back to its original string value."""
    return base64.urlsafe_b64decode(cursor.encode()).decode()


def _coerce_cursor(cursor_value: str, order_column) -> Any:
    """Convert a cursor string to the proper Python type for comparison."""
    if isinstance(order_column.type, DateTime):
        return datetime.fromisoformat(cursor_value)
    return cursor_value


async def paginate(
    db: AsyncSession,
    query,
    cursor: str | None,
    limit: int,
    order_column,
) -> dict:
    """
    Apply cursor-based pagination to a SQLAlchemy select query.

    Args:
        db: Async database session.
        query: A ``select()`` statement to paginate.
        cursor: Opaque cursor from the previous page (or ``None`` for the first page).
        limit: Maximum number of items to return.
        order_column: The column to order by and use as the cursor key.
            Must be unique and sortable (e.g. ``created_at``, ``id``).

    Returns:
        A dict with keys ``items``, ``next_cursor``, and ``has_more``.
    """
    if cursor is not None:
        cursor_value = _coerce_cursor(decode_cursor(cursor), order_column)
        query = query.where(order_column < cursor_value)

    query = query.order_by(order_column.desc()).limit(limit + 1)

    result = await db.execute(query)
    rows = list(result.scalars().all())

    has_more = len(rows) > limit
    items = rows[:limit]

    next_cursor = None
    if has_more and items:
        last_item = items[-1]
        cursor_val = getattr(last_item, order_column.key)
        next_cursor = encode_cursor(cursor_val)

    return {
        "items": items,
        "next_cursor": next_cursor,
        "has_more": has_more,
    }
