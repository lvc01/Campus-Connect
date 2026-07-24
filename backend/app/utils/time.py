"""Time helpers — single source of truth for normalizing datetimes across
SQLite (naive) and Postgres (tz-aware) backends."""

from datetime import datetime


def normalize_naive_utc(dt: datetime | None) -> datetime | None:
    """Drop tzinfo when present so all DB datetimes become naive UTC.

    The codebase persists timestamps as ``DateTime(timezone=True)`` against
    Postgres, but tests run against SQLite (aiosqlite) where columns round-
    trip as naive. Comparing naive vs. tz-aware datetimes raises
    ``TypeError: can't compare offset-naive and offset-aware datetimes``,
    so every consumer historically hand-rolled an
    ``hasattr(tzinfo) and tzinfo is not None`` dance. Centralize that here.

    Args:
        dt: A datetime that may or may not carry tzinfo. ``None`` passes
            through unchanged so call sites don't need a preceding guard.
    """
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.replace(tzinfo=None)
    return dt
