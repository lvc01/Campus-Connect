"""
Health endpoints — used by Render health checks and UptimeRobot keep-alive
pings. They deliberately perform **no** authentication and no DB writes so
they remain cheap and never throttle the service.
"""

from datetime import datetime, timezone

from fastapi import APIRouter
from sqlalchemy import text

from app.core.database import async_engine


router = APIRouter(prefix="/health", tags=["Health"])


@router.get("/ping")
async def ping():
    """Cheap keep-alive ping — no DB access."""
    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/deep")
async def deep():
    """Health endpoint that verifies the DB connection. Use sparingly."""
    db_ok = True
    try:
        async with async_engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception:
        db_ok = False
    return {"status": "ok" if db_ok else "degraded", "db": db_ok}
