"""
Async SQLAlchemy database engine, session factory, and base model.

Provides reusable mixins for timestamps and soft-delete patterns
used across all ORM models.
"""

from datetime import datetime
from typing import AsyncGenerator

from sqlalchemy import DateTime, func, text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.config import get_settings

settings = get_settings()

# ── Engine & session ──────────────────────────────────────────────────
#
# Sizing rationale (see production-readiness audit):
#   pool_size + max_overflow = 20 per worker process. With 4 Gunicorn workers
#   that's 80 connections — comfortably under Postgres's default
#   ``max_connections=100`` and leaves headroom for migrations / admin
#   sessions. For real horizontal scaling, front Postgres with PgBouncer in
#   transaction-pooling mode rather than raising this.
#
# ``echo`` is hard-wired to False. Letting it track DEBUG risks logging every
# SQL statement (catastrophic for log volume and throughput) if DEBUG is ever
# flipped on in a live environment.

_IS_POSTGRES = settings.DATABASE_URL.startswith("postgresql")

# Per-connection server options, applied only for Postgres. The SQLite test
# path (aiosqlite) does not understand these and would fail to connect.
_connect_args: dict = {}
if _IS_POSTGRES:
    # Kill any query that runs longer than 30s so a runaway statement can't
    # pin a pooled connection indefinitely. Tune per workload if needed.
    _connect_args["server_settings"] = {"statement_timeout": "30000"}

# Pool-sizing kwargs are only valid for Postgres. SQLite (used by the test
# suite via aiosqlite + StaticPool) rejects pool_size/max_overflow/pool_timeout.
_engine_kwargs: dict = {"echo": False, "pool_pre_ping": True, "connect_args": _connect_args}
if _IS_POSTGRES:
    # pool_size + max_overflow = 20 per worker process. With 4 Gunicorn workers
    # that's 80 connections — comfortably under Postgres's default
    # ``max_connections=100`` and leaves headroom for migrations / admin
    # sessions. For real horizontal scaling, front Postgres with PgBouncer in
    # transaction-pooling mode rather than raising this.
    _engine_kwargs.update(
        pool_size=10,
        max_overflow=10,
        pool_timeout=30,  # seconds to wait for a free connection before giving up
    )

async_engine = create_async_engine(settings.DATABASE_URL, **_engine_kwargs)

AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


# ── Declarative base ─────────────────────────────────────────────────

class Base(DeclarativeBase):
    """Base class for all ORM models."""
    pass


# ── Mixins ────────────────────────────────────────────────────────────

class TimestampMixin:
    """Adds ``created_at`` and ``updated_at`` columns to a model."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class SoftDeleteMixin:
    """Adds a ``deleted_at`` column for soft-delete support."""

    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        default=None,
    )


# ── Dependency ────────────────────────────────────────────────────────

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yield an async database session, rolling back on error."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
