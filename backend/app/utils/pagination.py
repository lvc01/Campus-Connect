"""
Cursor-based pagination utilities.

Cursor pagination is used instead of offset pagination for better
performance with large datasets — it avoids the ``OFFSET`` scan and produces
stable pages even when new rows are inserted.

The cursor is an opaque, base64-encoded JSON tuple ``[sort_value, id]``. The
``id`` (primary key) acts as a deterministic tie-breaker so rows that share an
identical ``sort_value`` (e.g. two posts created in the same millisecond) are
neither duplicated nor skipped across pages — a correctness bug the previous
single-value ``created_at`` cursor had.
"""

import base64
import binascii
import json
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, asc, desc, or_, select
from sqlalchemy.ext.asyncio import AsyncSession


class InvalidCursorError(Exception):
    """Raised when a cursor cannot be decoded or is malformed."""


def encode_cursor(sort_value: Any, item_id: Any) -> str:
    """Encode a (sort_value, id) tuple into an opaque base64 cursor.

    UUIDs are normalised to ``str`` so the payload is JSON-serialisable.
    """
    payload = json.dumps(
        [_to_jsonable(sort_value), _to_jsonable(item_id)],
        separators=(",", ":"),
    )
    return base64.urlsafe_b64encode(payload.encode()).decode()


def decode_cursor(cursor: str) -> tuple[Any, Any]:
    """Decode a base64 cursor into its (sort_value, id) tuple.

    Raises ``InvalidCursorError`` for any malformed input instead of bubbling
    up a raw ``binascii.Error``/``ValueError`` (which would surface as an
    unhandled 500 at the API layer).
    """
    try:
        payload = base64.urlsafe_b64decode(cursor.encode()).decode()
        sort_value, item_id = json.loads(payload)
    except (binascii.Error, ValueError, json.JSONDecodeError, TypeError):
        raise InvalidCursorError("Malformed pagination cursor.")
    return sort_value, item_id


def _to_jsonable(value: Any) -> Any:
    """Make a value JSON-serialisable (UUID → str, datetime stays ISO via str)."""
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def _coerce(value: Any, order_column) -> Any:
    """Convert a deserialised cursor value to the column's Python type."""
    if isinstance(order_column.type, DateTime) and isinstance(value, str):
        return datetime.fromisoformat(value)
    if isinstance(value, str):
        # Primary-key tie-breaker — coerce back to UUID if it looks like one.
        try:
            return uuid.UUID(value)
        except ValueError:
            return value
    return value


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
        cursor: Opaque cursor from the previous page (or ``None`` for the
            first page).
        limit: Maximum number of items to return.
        order_column: The column to order by and use as the primary cursor key
            (e.g. ``Post.created_at``). The row's primary key is used as a
            tie-breaker so non-unique sort values paginate correctly.

    Returns:
        A dict with keys ``items``, ``next_cursor``, and ``has_more``.

    Raises:
        InvalidCursorError: If ``cursor`` is provided but malformed.
    """
    # Resolve the model + primary key column for the tie-breaker.
    model = order_column.class_
    pk_column = list(model.__table__.primary_key.columns)[0]

    # Always order by (sort_col DESC, pk DESC) for a stable, total order.
    query = query.order_by(desc(order_column), desc(pk_column))

    if cursor is not None:
        sort_value, item_id = decode_cursor(cursor)
        sort_value = _coerce(sort_value, order_column)
        item_id = _coerce(item_id, pk_column)

        # "Strictly before" in the (sort_col, pk) total order:
        #   sort_col < cursor_sort OR (sort_col == cursor_sort AND pk < cursor_pk)
        query = query.where(
            or_(
                order_column < sort_value,
                (order_column == sort_value) & (pk_column < item_id),
            )
        )

    query = query.limit(limit + 1)

    result = await db.execute(query)
    rows = list(result.scalars().unique().all())

    has_more = len(rows) > limit
    items = rows[:limit]

    next_cursor = None
    if has_more and items:
        last_item = items[-1]
        next_cursor = encode_cursor(
            getattr(last_item, order_column.key),
            getattr(last_item, pk_column.key),
        )

    return {
        "items": items,
        "next_cursor": next_cursor,
        "has_more": has_more,
    }
