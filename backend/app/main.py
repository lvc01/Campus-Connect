"""
FastAPI application entry point.

Creates the app, wires up middleware, exception handlers, and the
versioned API router. Hit ``/docs`` for the interactive Swagger UI.
"""

import logging
import sys
from contextlib import asynccontextmanager
from pathlib import Path

import sentry_sdk
from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi_limiter import FastAPILimiter
from prometheus_fastapi_instrumentator import Instrumentator
from pythonjsonlogger import jsonlogger
import redis.asyncio as redis
from sqlalchemy import select

from app.api.v1.router import api_v1_router
from app.config import get_settings
from app.core.csrf import CsrfMiddleware
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import AppException, NotFoundException, app_exception_handler
from app.models.user import User
from app.utils.pagination import InvalidCursorError
from app.websocket.handler import ws_router

settings = get_settings()

# ── Structured logging ────────────────────────────────────────────────

_log_handler = logging.StreamHandler(sys.stdout)
_log_handler.setFormatter(
    jsonlogger.JsonFormatter(
        fmt="%(asctime)s %(levelname)s %(name)s %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S%z",
    )
)
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    handlers=[_log_handler],
)
logger = logging.getLogger(__name__)

# ── Sentry ────────────────────────────────────────────────────────────

sentry_sdk.init(
    dsn=settings.SENTRY_DSN,
    environment=settings.ENVIRONMENT,
    traces_sample_rate=1.0 if settings.DEBUG else 0.1,
    enable_tracing=True,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle events."""
    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(exist_ok=True)

    if settings.REDIS_ENABLED:
        try:
            redis_conn = redis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=2,
                socket_timeout=None,
            )
            await redis_conn.ping()
            await FastAPILimiter.init(redis_conn)
            logger.info("Redis rate-limiter ready at %s", settings.REDIS_URL)
        except Exception as e:
            logger.warning(
                "Redis unavailable (%s) — rate limiting and WS pub/sub disabled. "
                "Set REDIS_ENABLED=false in .env to silence this.",
                e,
            )
            redis_conn = None
    else:
        redis_conn = None
        logger.info("Redis disabled (REDIS_ENABLED=false) — single-worker mode.")

    from app.websocket.manager import manager
    await manager.connect_redis()

    logger.info("🚀 %s API started", settings.APP_NAME)
    yield
    logger.info("👋 %s API shutting down", settings.APP_NAME)
    await manager.disconnect_redis()
    if redis_conn is not None:
        try:
            await redis_conn.close()
        except Exception:
            pass


app = FastAPI(
    title=settings.APP_NAME,
    description=(
        "A verified, university-email-only social platform for students — "
        "combining a social feed, clubs, events, academics, marketplace, "
        "and real-time messaging in one platform."
    ),
    version="0.1.0",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    lifespan=lifespan,
)

# ── Middleware ────────────────────────────────────────────────────────
# Order matters: CORS is outermost so OPTIONS preflight is answered before
# CSRF validation runs. CSRF is applied to all cookie-authenticated,
# state-changing requests (double-submit token); bearer-only clients such
# as the mobile app are exempt because they can't be CSRF'd.

app.add_middleware(CsrfMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-CSRF-Token"],
)

# ── Prometheus metrics ────────────────────────────────────────────────

Instrumentator().instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)
logger.info("Prometheus metrics exposed at /metrics")

# ── Exception handlers ───────────────────────────────────────────────

app.add_exception_handler(AppException, app_exception_handler)


@app.exception_handler(InvalidCursorError)
async def invalid_cursor_handler(request: Request, exc: InvalidCursorError) -> JSONResponse:
    """Malformed pagination cursor → 400 instead of an unhandled 500."""
    return JSONResponse(
        status_code=400,
        content={"detail": str(exc), "error_code": "INVALID_CURSOR"},
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch unhandled exceptions (e.g. DB errors) to prevent leaking stack traces."""
    logger.exception("Unhandled application exception", exc_info=exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error.", "error_code": "INTERNAL_ERROR"},
    )

# ── Routers ───────────────────────────────────────────────────────────

app.include_router(api_v1_router)


# ── File serving ───────────────────────────────────────────────────────

@app.get("/uploads/{filename:path}", tags=["System"])
async def serve_upload(
    filename: str,
    _current_user: User = Depends(get_current_user),
) -> FileResponse:
    """Serve an uploaded media file.

    Requires authentication — only logged-in users can access uploads.
    The ``filename`` is user-controlled, so we resolve the candidate path
    and confirm it stays inside ``UPLOAD_DIR`` before opening — without
    this check, a request like ``/uploads/../../etc/passwd`` would happily
    read arbitrary files off the server.
    """
    upload_root = Path(settings.UPLOAD_DIR).resolve()
    filepath = (upload_root / filename).resolve()
    try:
        filepath.relative_to(upload_root)
    except ValueError:
        raise NotFoundException(detail="File not found.")
    if not filepath.is_file():
        raise NotFoundException(detail="File not found.")
    return FileResponse(str(filepath))

app.include_router(ws_router)


# ── Health check ──────────────────────────────────────────────────────

@app.get("/health", tags=["System"])
async def health_check(db=Depends(get_db)) -> dict:
    """Return service health including database connectivity."""
    db_ok = False
    try:
        await db.execute(select(1))
        db_ok = True
    except Exception:
        pass

    result = {
        "status": "healthy" if db_ok else "degraded",
        "service": settings.APP_NAME,
        "version": "0.1.0",
        "database": "connected" if db_ok else "disconnected",
    }
    if not db_ok:
        from fastapi import status
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, content=result)
    return result
