"""
Authentication API endpoints.

Handles the complete auth lifecycle: registration with university
email validation, OTP verification, login, token refresh, and logout.
"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.config import get_settings
from app.core.exceptions import BadRequestException, RateLimitException
from app.core.rate_limiter import rate_limit
from app.core.security import create_ws_token
from app.models.user import OTPPurpose, User
from app.schemas.auth import (
    AuthResponse,
    ForgotPasswordRequest,
    LoginRequest,
    RefreshTokenRequest,
    RegisterRequest,
    ResendOTPRequest,
    ResetPasswordRequest,
    TokenResponse,
    VerifyOTPRequest,
)
from app.schemas.common import MessageResponse
from app.schemas.user import UserResponse
from app.services.auth_service import get_auth_service
from app.services.email_service import get_email_service
from app.services.otp_service import get_otp_service
from app.services.user_service import get_user_service

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new account",
)
async def register(
    data: RegisterRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit(max_requests=5, window_seconds=60)),
) -> MessageResponse:
    """
    Register a new student account with a university email address.

    The email domain must match one of the allowed university domains.
    An OTP code is sent to the provided email for verification.
    """
    auth_service = get_auth_service()
    result = await auth_service.register(data, db)
    return MessageResponse(message=result["message"], dev_otp=result.get("dev_otp"))


@router.post(
    "/verify-otp",
    response_model=AuthResponse,
    summary="Verify email with OTP",
)
async def verify_otp(
    data: VerifyOTPRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit(max_requests=10, window_seconds=60)),
) -> AuthResponse:
    """
    Verify the user's email address using the 6-digit OTP code.

    On success, the account is activated and JWT tokens are returned.
    """
    auth_service = get_auth_service()
    return await auth_service.verify_email(data, db)


@router.post(
    "/resend-otp",
    response_model=MessageResponse,
    summary="Resend OTP code",
)
async def resend_otp(
    data: ResendOTPRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit(max_requests=3, window_seconds=60)),
) -> MessageResponse:
    """
    Resend the OTP verification code to the user's email.

    Rate-limited to one request per 60 seconds to prevent abuse.
    """
    user_service = get_user_service()
    otp_service = get_otp_service()
    email_service = get_email_service()

    user = await user_service.get_user_by_email(data.email, db)
    if user is None:
        raise BadRequestException(detail="No account found with this email.")

    if user.is_verified:
        raise BadRequestException(detail="Email is already verified.")

    # Rate limit: check last OTP was created > 60 seconds ago
    last_created = await otp_service.get_last_otp_created_at(
        user_id=user.id,
        purpose=OTPPurpose.email_verification,
        db=db,
    )
    if last_created and datetime.now(timezone.utc) - last_created < timedelta(seconds=60):
        raise RateLimitException(
            detail="Please wait at least 60 seconds before requesting a new OTP."
        )

    otp = await otp_service.create_otp(
        user_id=user.id,
        purpose=OTPPurpose.email_verification,
        db=db,
    )
    await email_service.send_otp_email(
        to=user.email,
        otp=otp,
        purpose="Email Verification",
    )

    dev_otp = otp if get_settings().OTP_DELIVERY_METHOD == "console" else None
    return MessageResponse(message="A new OTP code has been sent to your email.", dev_otp=dev_otp)


@router.post(
    "/forgot-password",
    response_model=MessageResponse,
    summary="Request password reset OTP",
)
async def forgot_password(
    data: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit(max_requests=3, window_seconds=60)),
) -> MessageResponse:
    """
    Send a password-reset OTP to the user's email if the account exists.

    Always returns the same response to prevent email enumeration.
    """
    auth_service = get_auth_service()
    return await auth_service.forgot_password(data, db)


@router.post(
    "/reset-password",
    response_model=MessageResponse,
    summary="Reset password with OTP",
)
async def reset_password(
    data: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit(max_requests=5, window_seconds=60)),
) -> MessageResponse:
    """
    Reset the user's password using the OTP sent to their email.

    On success, all existing sessions are invalidated.
    """
    auth_service = get_auth_service()
    return await auth_service.reset_password(data, db)


@router.post(
    "/login",
    response_model=AuthResponse,
    summary="Log in",
)
async def login(
    data: LoginRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit(max_requests=10, window_seconds=60)),
) -> AuthResponse:
    """
    Authenticate with email and password.

    Returns JWT access and refresh tokens along with user data.
    The user must have a verified email to log in.
    """
    auth_service = get_auth_service()
    return await auth_service.login(data, db)


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Refresh access token",
)
async def refresh(
    data: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit(max_requests=10, window_seconds=60)),
) -> TokenResponse:
    """
    Exchange a valid refresh token for a new access + refresh token pair.

    The old refresh token is revoked (token rotation). If a revoked
    token is reused, all sessions for the user are invalidated as a
    security measure.
    """
    auth_service = get_auth_service()
    return await auth_service.refresh_token(data, db)


@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="Log out",
)
async def logout(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """
    Log out the current user by revoking all their refresh tokens.
    """
    auth_service = get_auth_service()
    await auth_service.logout(current_user.id, db)
    return MessageResponse(message="Successfully logged out.")


@router.post(
    "/ws-token",
    response_model=TokenResponse,
    summary="Get a short-lived WebSocket token",
)
async def get_ws_token(
    current_user: User = Depends(get_current_user),
    _: None = Depends(rate_limit(max_requests=5, window_seconds=60)),
) -> TokenResponse:
    """
    Issue a short-lived JWT (5 min) scoped to WebSocket connections only.

    This avoids exposing the long-lived access token in the WebSocket URL
    query string, which would leak it to server logs and browser history.
    """
    ws_token = create_ws_token(data={"sub": str(current_user.id)})
    return TokenResponse(access_token=ws_token, refresh_token="", token_type="ws")


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current user",
)
async def get_me(
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    """
    Return the currently authenticated user and their profile.
    """
    return UserResponse.model_validate(current_user)
