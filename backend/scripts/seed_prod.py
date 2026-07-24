"""
Production seed wrapper — runs the existing ``seed.py`` against whatever
``DATABASE_URL`` is configured.

Idempotent: if the ``users`` table already has rows, we skip the seed.
``seed.py`` generates fresh UUIDs on every run, so running it twice
would create duplicate demo accounts — preventing that is what makes
this safe to invoke on every boot.
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

# Add the backend/ root so `import app...` resolves when this script is
# invoked with CWD != backend/ (e.g. from Render's startCommand).
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
# Add the scripts/ dir so we can import the sibling seed.py module.
sys.path.insert(0, str(Path(__file__).resolve().parent))

from sqlalchemy import select  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession  # noqa: E402

from app.core.database import AsyncSessionLocal  # noqa: E402
from app.models.user import User  # noqa: E402

import seed as seed_module  # type: ignore  [noqa]


async def _already_seeded() -> bool:
    async with AsyncSessionLocal() as db:  # type: AsyncSession
        existing = await db.scalar(select(User.id).limit(1))
    return existing is not None


async def main() -> None:
    if await _already_seeded():
        print("↺ Database already has users — skipping seed.")
        return
    await seed_module.seed()
    print("✓ Demo data seeded.")


if __name__ == "__main__":
    asyncio.run(main())
