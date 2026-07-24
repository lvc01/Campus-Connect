"""
Authentication endpoint test suite.

Covers registration, OTP verification, login, token refresh,
and protected route access — the full auth lifecycle.
"""

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_refresh_token, hash_otp, hash_password, hash_token
from app.models.user import OTPCode, OTPPurpose, Profile, RefreshToken, User, UserRole


# ── Registration ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_register_success(client: AsyncClient):
    """Valid university email should register successfully (201)."""
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "newstudent@cuchd.in",
            "password": "StrongPass1",
            "display_name": "New Student",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert "OTP" in data["message"] or "otp" in data["message"].lower() or "verification" in data["message"].lower()


@pytest.mark.asyncio
async def test_register_invalid_email_domain(client: AsyncClient):
    """Non-university email should be rejected (400)."""
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "user@gmail.com",
            "password": "StrongPass1",
            "display_name": "Bad Domain",
        },
    )
    assert response.status_code == 400
    assert "university" in response.json()["detail"].lower() or "domain" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient):
    """Registering the same email twice should return 409."""
    payload = {
        "email": "duplicate@cuchd.in",
        "password": "StrongPass1",
        "display_name": "First",
    }
    await client.post("/api/v1/auth/register", json=payload)
    response = await client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_register_weak_password(client: AsyncClient):
    """Password without uppercase/lowercase/digit should fail validation (422)."""
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "weak@cuchd.in",
            "password": "short",
            "display_name": "Weak Password",
        },
    )
    assert response.status_code == 422


# ── OTP Verification ─────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_verify_otp_success(client: AsyncClient, db_session: AsyncSession):
    """Correct OTP should verify the user and return tokens."""
    # Create unverified user
    user = User(
        email="otptest@cuchd.in",
        hashed_password=hash_password("TestPass123"),
        is_verified=False,
    )
    db_session.add(user)
    await db_session.flush()

    profile = Profile(user_id=user.id, display_name="OTP Tester")
    db_session.add(profile)

    otp = OTPCode(
        user_id=user.id,
        code=hash_otp("123456"),
        purpose=OTPPurpose.email_verification,
        expires_at=datetime.utcnow() + timedelta(minutes=10),
    )
    db_session.add(otp)
    await db_session.commit()

    response = await client.post(
        "/api/v1/auth/verify-otp",
        json={"email": "otptest@cuchd.in", "code": "123456"},
    )
    assert response.status_code == 200
    # Tokens are delivered via httpOnly Set-Cookie headers, not in the body
    # (consistent with the cookie-based auth migration).
    set_cookies = response.headers.get_list("set-cookie")
    assert any("cc_access_token=" in h for h in set_cookies), "Access token cookie missing"
    assert any("cc_refresh_token=" in h for h in set_cookies), "Refresh token cookie missing"
    data = response.json()
    assert data["user"]["is_verified"] is True


@pytest.mark.asyncio
async def test_verify_otp_wrong_code(client: AsyncClient, db_session: AsyncSession):
    """Wrong OTP code should return 400."""
    user = User(
        email="wrongotp@cuchd.in",
        hashed_password=hash_password("TestPass123"),
        is_verified=False,
    )
    db_session.add(user)
    await db_session.flush()

    profile = Profile(user_id=user.id, display_name="Wrong OTP")
    db_session.add(profile)

    otp = OTPCode(
        user_id=user.id,
        code=hash_otp("111111"),
        purpose=OTPPurpose.email_verification,
        expires_at=datetime.utcnow() + timedelta(minutes=10),
    )
    db_session.add(otp)
    await db_session.commit()

    response = await client.post(
        "/api/v1/auth/verify-otp",
        json={"email": "wrongotp@cuchd.in", "code": "999999"},
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_verify_otp_expired(client: AsyncClient, db_session: AsyncSession):
    """Expired OTP should return 400."""
    user = User(
        email="expiredotp@cuchd.in",
        hashed_password=hash_password("TestPass123"),
        is_verified=False,
    )
    db_session.add(user)
    await db_session.flush()

    profile = Profile(user_id=user.id, display_name="Expired OTP")
    db_session.add(profile)

    otp = OTPCode(
        user_id=user.id,
        code=hash_otp("654321"),
        purpose=OTPPurpose.email_verification,
        expires_at=datetime.utcnow() - timedelta(minutes=1),  # Already expired
    )
    db_session.add(otp)
    await db_session.commit()

    response = await client.post(
        "/api/v1/auth/verify-otp",
        json={"email": "expiredotp@cuchd.in", "code": "654321"},
    )
    assert response.status_code == 400


# ── Login ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, test_user: User):
    """Verified user with correct credentials should get tokens."""
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "testuser@cuchd.in", "password": "TestPass123"},
    )
    assert response.status_code == 200
    # Tokens are delivered via httpOnly Set-Cookie headers, not in the body.
    set_cookies = response.headers.get_list("set-cookie")
    assert any("cc_access_token=" in h for h in set_cookies), "Access token cookie missing"
    assert any("cc_refresh_token=" in h for h in set_cookies), "Refresh token cookie missing"
    data = response.json()
    assert data["user"]["email"] == "testuser@cuchd.in"


@pytest.mark.asyncio
async def test_login_unverified_user(client: AsyncClient, unverified_user: User):
    """Unverified user should get 403 when trying to log in."""
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "unverified@cuchd.in", "password": "TestPass123"},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient, test_user: User):
    """Wrong password should return 401."""
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "testuser@cuchd.in", "password": "WrongPass999"},
    )
    assert response.status_code == 401


# ── Token Refresh ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_refresh_token_success(client: AsyncClient, test_user: User):
    """Valid refresh token in cookie should return new token pair in Set-Cookie headers."""
    # First, login to get a real refresh token via the API
    login_response = await client.post(
        "/api/v1/auth/login",
        json={"email": "testuser@cuchd.in", "password": "TestPass123"},
    )
    assert login_response.status_code == 200, f"Login failed: {login_response.status_code} {login_response.text}"

    # Extract refresh token from Set-Cookie headers
    set_cookie_headers = login_response.headers.get_list("set-cookie")
    refresh_cookie = None
    for header in set_cookie_headers:
        if header.startswith("cc_refresh_token="):
            refresh_cookie = header.split("=", 1)[1].split(";")[0]
            break

    assert refresh_cookie, f"Refresh token cookie not found. Set-Cookie headers: {set_cookie_headers}"

    # Refresh using the cookie — new tokens are returned via Set-Cookie headers
    response = await client.post(
        "/api/v1/auth/refresh",
        headers={"Cookie": f"cc_refresh_token={refresh_cookie}"},
    )
    assert response.status_code == 200, f"Refresh failed: {response.status_code} {response.text}"
    # Tokens are now in Set-Cookie headers, not in JSON body
    new_cookies = response.headers.get_list("set-cookie")
    has_new_access = any("cc_access_token=" in h for h in new_cookies)
    has_new_refresh = any("cc_refresh_token=" in h for h in new_cookies)
    assert has_new_access, "New access token cookie should be set"
    assert has_new_refresh, "New refresh token cookie should be set"


# ── Protected routes ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_me_authenticated(client: AsyncClient, auth_headers: dict):
    """Authenticated request to /me should return user data."""
    response = await client.get("/api/v1/auth/me", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "testuser@cuchd.in"
    assert data["profile"] is not None


@pytest.mark.asyncio
async def test_get_me_unauthenticated(client: AsyncClient):
    """Request without token should return 401."""
    response = await client.get("/api/v1/auth/me")
    assert response.status_code == 401
