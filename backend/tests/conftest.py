"""
Pytest fixtures for the CU Campus Connect test suite.

Sets up an async SQLite database, test client, and pre-built
user fixtures so tests can run without PostgreSQL.
"""

import asyncio
import os
import uuid
from datetime import datetime, timezone

os.environ["OTP_DELIVERY_METHOD"] = "console"

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.database import Base, get_db
from app.core.security import create_access_token, hash_password
from app.core.rate_limiter import rate_limit
from app.main import app
from app.models.user import Profile, User, UserRole

# ── Event loop ────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def event_loop():
    """Create a single event loop for the entire test session."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


# ── Database engine & session ─────────────────────────────────────────

TEST_DATABASE_URL = "sqlite+aiosqlite:///./test.db"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    echo=False,
)

TestSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


@pytest_asyncio.fixture(autouse=True)
async def setup_database():
    """Create all tables before each test and drop them after."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session() -> AsyncSession:
    """Provide a clean database session for a test."""
    async with TestSessionLocal() as session:
        yield session


# ── Override get_db ───────────────────────────────────────────────────

async def _override_get_db():
    """Yield a test database session instead of the production one."""
    async with TestSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise

app.dependency_overrides[get_db] = _override_get_db

from unittest.mock import AsyncMock, MagicMock, patch

# ── Mock External Services (Redis / Rate Limiter) ──────────────────────

# Mock Redis connection
mock_redis = AsyncMock()
patch("redis.asyncio.from_url", return_value=mock_redis).start()

# Mock FastAPI-Limiter to avoid needing Redis during tests
import fastapi_limiter
from fastapi_limiter import default_identifier, http_default_callback, ws_default_callback

fastapi_limiter.FastAPILimiter.redis = mock_redis
fastapi_limiter.FastAPILimiter.prefix = "fastapi-limiter"
fastapi_limiter.FastAPILimiter.identifier = default_identifier
fastapi_limiter.FastAPILimiter.http_callback = http_default_callback
fastapi_limiter.FastAPILimiter.ws_callback = ws_default_callback

patch("fastapi_limiter.depends.RateLimiter.__call__", new_callable=AsyncMock).start()

# Mock WebSocket manager Redis connections
from app.websocket.manager import ConnectionManager
patch.object(ConnectionManager, "connect_redis", new_callable=AsyncMock).start()
patch.object(ConnectionManager, "disconnect_redis", new_callable=AsyncMock).start()
patch.object(ConnectionManager, "send_to_user", new_callable=AsyncMock).start()
patch.object(ConnectionManager, "send_to_conversation", new_callable=AsyncMock).start()


# ── HTTP client ───────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def client() -> AsyncClient:
    """Async HTTP client targeting the FastAPI app."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac


# ── User fixtures ─────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession) -> User:
    """Create and return a verified test user."""
    user = User(
        id=uuid.uuid4(),
        email="testuser@cuchd.in",
        hashed_password=hash_password("TestPass123"),
        role=UserRole.student,
        is_verified=True,
        is_active=True,
    )
    db_session.add(user)
    await db_session.flush()

    profile = Profile(
        user_id=user.id,
        display_name="Test User",
        faculty="Science",
        year_of_study=2,
    )
    db_session.add(profile)
    await db_session.commit()
    return user


@pytest_asyncio.fixture
async def unverified_user(db_session: AsyncSession) -> User:
    """Create and return an unverified test user."""
    user = User(
        id=uuid.uuid4(),
        email="unverified@cuchd.in",
        hashed_password=hash_password("TestPass123"),
        role=UserRole.student,
        is_verified=False,
        is_active=True,
    )
    db_session.add(user)
    await db_session.flush()

    profile = Profile(
        user_id=user.id,
        display_name="Unverified User",
    )
    db_session.add(profile)
    await db_session.commit()
    return user


@pytest_asyncio.fixture
def auth_headers(test_user: User) -> dict[str, str]:
    """Return HTTP headers with a valid JWT for the test user."""
    token = create_access_token(data={"sub": str(test_user.id)})
    return {"Authorization": f"Bearer {token}"}
