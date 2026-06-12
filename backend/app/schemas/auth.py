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
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(min_length=2, max_length=100)
    faculty: str | None = None
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
    new_password: str = Field(min_length=8, max_length=128)

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


class AuthResponse(TokenResponse):
    """Tokens paired with the authenticated user object."""

    user: UserResponse
