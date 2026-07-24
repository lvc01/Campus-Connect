"""
Search endpoint test suite.

Covers global search with empty query, short query, and valid query.
"""

import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.user import Profile, User, UserRole


@pytest.mark.asyncio
async def test_search_empty_query(client: AsyncClient, auth_headers: dict):
    """Empty search query should return 422 (validation error)."""
    resp = await client.get("/api/v1/search", headers=auth_headers, follow_redirects=True)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_search_short_query(client: AsyncClient, auth_headers: dict):
    """Single-character query should return 422 (min_length=2)."""
    resp = await client.get("/api/v1/search?q=a", headers=auth_headers, follow_redirects=True)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_search_valid_query(client: AsyncClient, auth_headers: dict, test_user: User):
    """Valid query should return matching results."""
    resp = await client.get(
        "/api/v1/search?q=Test", headers=auth_headers, follow_redirects=True
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "users" in data
    assert "posts" in data
    assert "clubs" in data


@pytest.mark.asyncio
async def test_search_no_auth(client: AsyncClient):
    """Unauthenticated search should return 401."""
    resp = await client.get("/api/v1/search?q=test", follow_redirects=True)
    assert resp.status_code in (401, 403)
