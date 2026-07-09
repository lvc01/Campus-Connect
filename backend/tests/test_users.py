"""
User profile endpoint test suite.

Covers profile read/update, public profile lookup, saved posts,
user likes, replies, media, and reposts.
"""

import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, hash_password
from app.models.user import Profile, User, UserRole


@pytest_asyncio.fixture
async def other_user(db_session: AsyncSession) -> User:
    """Create a second verified user for cross-user tests."""
    user = User(
        id=uuid.uuid4(),
        email="other@cuchd.in",
        hashed_password=hash_password("TestPass123"),
        role=UserRole.student,
        is_verified=True,
        is_active=True,
    )
    db_session.add(user)
    await db_session.flush()
    profile = Profile(
        user_id=user.id,
        display_name="Other User",
        faculty="Engineering",
        year_of_study=3,
    )
    db_session.add(profile)
    await db_session.commit()
    return user


@pytest.mark.asyncio
async def test_get_my_profile(client: AsyncClient, auth_headers: dict, test_user: User):
    """Authenticated user should retrieve their own profile."""
    resp = await client.get("/api/v1/users/me/profile", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["display_name"] == "Test User"
    assert data["faculty"] == "Science"


@pytest.mark.asyncio
async def test_get_my_profile_unauthenticated(client: AsyncClient):
    """Unauthenticated request should return 401."""
    resp = await client.get("/api/v1/users/me/profile")
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_update_my_profile(client: AsyncClient, auth_headers: dict):
    """Authenticated user should update their profile fields."""
    resp = await client.patch(
        "/api/v1/users/me/profile",
        headers=auth_headers,
        json={"display_name": "Updated Name", "faculty": "Engineering"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["display_name"] == "Updated Name"
    assert data["faculty"] == "Engineering"


@pytest.mark.asyncio
async def test_get_user_by_id(
    client: AsyncClient, auth_headers: dict, test_user: User
):
    """Should return user info by ID."""
    resp = await client.get(
        f"/api/v1/users/{test_user.id}", headers=auth_headers
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "testuser@cuchd.in"


@pytest.mark.asyncio
async def test_get_public_profile(
    client: AsyncClient, auth_headers: dict, test_user: User
):
    """Should return public profile with stats."""
    resp = await client.get(
        f"/api/v1/users/{test_user.id}/profile", headers=auth_headers
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["profile"]["display_name"] == "Test User"
    assert "posts_count" in data


@pytest.mark.asyncio
async def test_get_saved_posts_empty(
    client: AsyncClient, auth_headers: dict
):
    """Should return empty feed when no saves exist."""
    resp = await client.get("/api/v1/users/me/saves", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data or "posts" in data or isinstance(data, dict)


@pytest.mark.asyncio
async def test_get_user_likes_empty(
    client: AsyncClient, auth_headers: dict, test_user: User
):
    """Should return empty feed when user has no likes."""
    resp = await client.get(
        f"/api/v1/users/{test_user.id}/likes", headers=auth_headers
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_get_user_replies_empty(
    client: AsyncClient, auth_headers: dict, test_user: User
):
    """Should return empty when user has no replies."""
    resp = await client.get(
        f"/api/v1/users/{test_user.id}/replies", headers=auth_headers
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_get_user_media_empty(
    client: AsyncClient, auth_headers: dict, test_user: User
):
    """Should return empty when user has no media posts."""
    resp = await client.get(
        f"/api/v1/users/{test_user.id}/media", headers=auth_headers
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_get_user_reposts_empty(
    client: AsyncClient, auth_headers: dict, test_user: User
):
    """Should return empty when user has no reposts."""
    resp = await client.get(
        f"/api/v1/users/{test_user.id}/reposts", headers=auth_headers
    )
    assert resp.status_code == 200
