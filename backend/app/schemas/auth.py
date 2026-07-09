"""
Pydantic schemas for the authentication endpoints.

Includes input validation with password complexity rules and
structured response models for token pairs.
"""

import re

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.schemas.user import UserResponse


class RegisterRequest(BaseModel):
    """Payload for ``POST /auth/register``."""

    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    # Disallow control characters, zero-width spaces, and RTL/LTR overrides
    # (U+202E etc.) that enable username spoofing and homoglyph attacks.
    display_name: str = Field(
        min_length=2,
        max_length=100,
        pattern=r"^[^\u0000-\u001F\u007F\u200B-\u200F\u2028-\u202F]+$",
    )
    faculty: str | None = Field(default=None, max_length=100)
    year_of_study: int | None = Field(default=None, ge=1, le=7)

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        """Enforce password complexity: uppercase, lowercase, and digit."""
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter.")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter.")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit.")
        return v


class VerifyOTPRequest(BaseModel):
    """Payload for ``POST /auth/verify-otp``."""

    email: EmailStr
    code: str = Field(min_length=6, max_length=6)


class ResendOTPRequest(BaseModel):
    """Payload for ``POST /auth/resend-otp``."""

    email: EmailStr


class LoginRequest(BaseModel):
    """Payload for ``POST /auth/login``."""

    email: EmailStr
    password: str


class RefreshTokenRequest(BaseModel):
    """Payload for ``POST /auth/refresh``."""

    refresh_token: str


class TokenResponse(BaseModel):
    """Access + refresh token pair returned on login / refresh."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class ForgotPasswordRequest(BaseModel):
    """Payload for ``POST /auth/forgot-password``."""

    email: EmailStr


class ResetPasswordRequest(BaseModel):
    """Payload for ``POST /auth/reset-password``."""

    email: EmailStr
    code: str = Field(min_length=6, max_length=6)
    new_password: str = Field(min_length=8, max_length=72)

    @field_validator("new_password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        """Enforce password complexity: uppercase, lowercase, and digit."""
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter.")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter.")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit.")
        return v


class AuthResponse(BaseModel):
    """Response after successful authentication.

    Includes the user and (optionally) the token pair. Token delivery is
    duplicated intentionally: web clients receive tokens via httpOnly
    ``Set-Cookie`` headers, while mobile / API clients read them from the
    body. Either channel works in isolation; both is harmless and lets one
    code path serve all client types.
    """

    user: UserResponse
    access_token: str | None = None
    refresh_token: str | None = None
    token_type: str = "bearer"


class PushTokenRequest(BaseModel):
    """Payload for ``POST /auth/mobile/push-token``.

    Sent as a JSON body (not a query param) so push tokens — which contain
    special characters and are long — don't end up in server access logs.
    """

    push_token: str = Field(min_length=10, max_length=500)
    platform: str = Field(default="ios", pattern=r"^(ios|android)$")
