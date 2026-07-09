"""
Admin endpoint test suite.

Covers admin stats access control and data.
"""

import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, hash_password
from app.models.user import Profile, User, UserRole


@pytest_asyncio.fixture
async def admin_user(db_session: AsyncSession) -> User:
    """Create an admin user."""
    user = User(
        id=uuid.uuid4(),
        email="admin@cuchd.in",
        hashed_password=hash_password("AdminPass123"),
        role=UserRole.admin,
        is_verified=True,
        is_active=True,
    )
    db_session.add(user)
    await db_session.flush()
    profile = Profile(
        user_id=user.id,
        display_name="Admin User",
        faculty="Administration",
    )
    db_session.add(profile)
    await db_session.commit()
    return user


@pytest_asyncio.fixture
def admin_headers(admin_user: User) -> dict[str, str]:
    """Return HTTP headers with a valid JWT for the admin user."""
    token = create_access_token(data={"sub": str(admin_user.id)})
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_admin_stats_requires_admin(client: AsyncClient, auth_headers: dict):
    """Non-admin user should be denied access to admin stats."""
    resp = await client.get("/api/v1/admin/stats", headers=auth_headers)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_admin_stats_requires_auth(client: AsyncClient):
    """Unauthenticated request should be rejected."""
    resp = await client.get("/api/v1/admin/stats")
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_admin_stats_returns_counts(client: AsyncClient, admin_headers: dict):
    """Admin should receive platform-wide counts."""
    resp = await client.get("/api/v1/admin/stats", headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "users" in data
    assert "posts" in data
    assert "clubs" in data
    assert "events" in data
    assert "listings" in data
    assert "messages" in data
    assert isinstance(data["users"], int)
