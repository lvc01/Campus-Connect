"""
Production seed wrapper — runs the existing ``seed.py`` against whatever
``DATABASE_URL`` is configured. Idempotent for the demo content (re-seeds
with the same fixture values).
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

# Make the seed module importable.
sys.path.insert(0, str(Path(__file__).resolve().parent))

import seed as seed_module  # type: ignore  [noqa]


async def main() -> None:
    await seed_module.seed()
    print("✓ Production seed complete")


if __name__ == "__main__":
    asyncio.run(seed_module.seed())
    print("✓ Demo data seeded (users + posts + clubs + events + listings)")
