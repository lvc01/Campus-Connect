"""
Initialize the production database schema using SQLAlchemy ``create_all``
plus the alembic ``stamp head`` workaround.

Why not ``alembic upgrade head``? The migration chain is broken — the
initial schema already creates the ``shares`` table but a later migration
``add_shares_table`` recreates it. Alembic is configured for transactional
DDL, so the duplicate rolls back the entire migration batch, leaving the
DB empty. Until that's fixed upstream, we bootstrap via ``create_all`` and
stamp the version table to head so alembic does not try to re-run.

Idempotent: safe to run multiple times.
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

# The project root must be importable regardless of CWD — when invoked as
# `python scripts/create_all_schema.py` from anywhere, Python only puts
# the *script's* directory on sys.path, so ``import app.*`` fails. Add
# the backend/ root explicitly.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from alembic.config import Config as AlembicConfig
from sqlalchemy import inspect, text

from alembic import command

from app.config import get_settings
from app.core.database import Base, async_engine
# Importing the module registers all ORM models on Base.metadata.
import app.models  # noqa: F401  (side-effect import)


async def main() -> None:
    settings = get_settings()
    print(f"Connecting to {settings.DATABASE_URL}")

    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

        # Stamp alembic_version to head so subsequent `alembic upgrade head`
        # calls become no-ops; runs only if the table hasn't been created.
        ins = inspect(await conn.run_sync(lambda c: c))
        tables = await conn.run_sync(lambda c: inspect(c).get_table_names())
        if "alembic_version" not in tables:
            # We can't use async alembic env here; defer to sync CLI.
            pass

        # If any alembic tables or alembic_version exist, show counts.
        for t in tables:
            count = await conn.scalar(text(f'SELECT COUNT(*) FROM "{t}"'))
            print(f"  {t}: {count}")

    await async_engine.dispose()

    # Stamp head via sync alembic.
    cfg = AlembicConfig("alembic.ini")
    cfg.set_main_option("sqlalchemy.url", settings.DATABASE_URL.replace("+asyncpg", "+psycopg2"))
    command.stamp(cfg, "head")
    print("✓ Schema created and stamped to head")


if __name__ == "__main__":
    asyncio.run(main())
