"""
Dump the local database schema (structure only) to stdout, suitable for
piping into ``psql`` or a Supabase SQL Editor.

Recommended usage:

    # From a clean local Postgres:
    pg_dump --schema-only --no-owner --no-privileges \
        "$DATABASE_URL" > infra/schema.sql

We wrap that here so it's a single, repeatable step.
"""

from __future__ import annotations

import os
import subprocess
import sys

from app.config import get_settings


def main() -> None:
    settings = get_settings()
    url = settings.DATABASE_URL

    # Replace the SQLAlchemy scheme with the libpq one for pg_dump.
    if url.startswith("postgresql+asyncpg://"):
        url = url.replace("postgresql+asyncpg://", "postgresql://", 1)
    if url.startswith("postgresql+psycopg2://"):
        url = url.replace("postgresql+psycopg2://", "postgresql://", 1)

    cmd = [
        "pg_dump",
        "--schema-only",
        "--no-owner",
        "--no-privileges",
        "--exclude-table=alembic_version",
        url,
    ]
    print(f"-- Running: {' '.join(cmd)}", file=sys.stderr)
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        sys.stderr.write(result.stderr)
        sys.exit(result.returncode)
    sys.stdout.write(result.stdout)


if __name__ == "__main__":
    main()
