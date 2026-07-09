"""
FastAPI dependency functions for authentication and authorization.

These are injected into route handlers via ``Depends()`` to enforce
authentication, verify roles, and provide the current user object.

Token resolution order:
  1. ``Authorization: Bearer <token>`` header (for API clients / WS).
  2. ``cc_access_token`` httpOnly cookie (for browser-based requests).
"""

import uuid

from fastapi import Depends, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.exceptions import ForbiddenException, UnauthorizedException
from app.core.security import decode_token
from app.models.user import User, UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


async def _extract_token(request: Request) -> str:
    """Extract the access token from the Authorization header or cookie.

    Falls back to the ``cc_access_token`` httpOnly cookie when no
    Authorization header is present (browser same-origin requests).
    """
    # 1. Authorization header (takes precedence)
    auth_header = request.headers.get("authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:]

    # 2. httpOnly cookie
    cookie_token = request.cookies.get("cc_access_token")
    if cookie_token:
        return cookie_token

    raise UnauthorizedException(detail="Not authenticated.")


async def get_current_user(
    token: str = Depends(_extract_token),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Extract and validate the current user from the JWT access token.

    Decodes the token, fetches the user from DB, and checks that the
    account is active and verified. Eager-loads the profile.

    Raises:
        UnauthorizedException: If the token is invalid or the user
            does not exist / is deactivated / is unverified.
    """
    payload = decode_token(token, token_type="access")
    user_id_str: str | None = payload.get("sub")

    if user_id_str is None:
        raise UnauthorizedException(detail="Token missing subject claim.")

    try:
        user_id = uuid.UUID(user_id_str)
    except ValueError:
        raise UnauthorizedException(detail="Invalid subject in token.")

    result = await db.execute(
        select(User)
        .options(selectinload(User.profile))
        .where(User.id == user_id, User.deleted_at.is_(None))
    )
    user = result.scalar_one_or_none()

    if user is None:
        raise UnauthorizedException(detail="User not found.")
    if not user.is_active:
        raise UnauthorizedException(detail="Account has been deactivated.")
    if not user.is_verified:
        raise ForbiddenException(detail="Email not verified. Please verify your email first.")

    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Convenience dependency that additionally ensures the user is active.

    This is a no-op if ``get_current_user`` already checks ``is_active``,
    but exists for explicit intent in route signatures.
    """
    if not current_user.is_active:
        raise UnauthorizedException(detail="Account has been deactivated.")
    return current_user


async def get_current_user_allow_inactive(
    token: str = Depends(_extract_token),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Like ``get_current_user`` but does **not** reject suspended users.

    A suspended (``is_active=False``) user still needs to authenticate to file
    an appeal against the action that suspended them — the standard
    ``get_current_user`` dependency blocks them outright. This variant performs
    the same token validation but allows inactive accounts through. Use it
    *only* on routes where a suspended user must retain access (e.g. appeals);
    everywhere else ``get_current_user`` should be used.
    """
    payload = decode_token(token, token_type="access")
    user_id_str: str | None = payload.get("sub")

    if user_id_str is None:
        raise UnauthorizedException(detail="Token missing subject claim.")

    try:
        user_id = uuid.UUID(user_id_str)
    except ValueError:
        raise UnauthorizedException(detail="Invalid subject in token.")

    result = await db.execute(
        select(User)
        .options(selectinload(User.profile))
        .where(User.id == user_id, User.deleted_at.is_(None))
    )
    user = result.scalar_one_or_none()

    if user is None:
        raise UnauthorizedException(detail="User not found.")

    return user


def require_role(*roles: UserRole):
    """
    Factory that returns a dependency checking the user's role.

    Usage::

        @router.get("/admin", dependencies=[Depends(require_role(UserRole.moderator))])
        async def admin_only(): ...
    """

    async def _role_checker(
        current_user: User = Depends(get_current_user),
    ) -> User:
        """Verify the current user holds one of the required roles."""
        if current_user.role not in roles:
            raise ForbiddenException(
                detail=f"This action requires one of the following roles: {', '.join(r.value for r in roles)}."
            )
        return current_user

    return _role_checker
