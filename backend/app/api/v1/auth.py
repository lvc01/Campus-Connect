"""
Authentication API endpoints.

Handles the complete auth lifecycle: registration with university
email validation, OTP verification, login, token refresh, and logout.

Token storage: access and refresh tokens are delivered via httpOnly,
Secure, SameSite=Strict cookies — never exposed to JavaScript.
A separate ``cc_csrf`` cookie (readable by JS) is used for CSRF
protection on state-changing requests.
"""

import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Request, Response, status
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
    PushTokenRequest,
    RefreshTokenRequest,
    RegisterRequest,
    ResendOTPRequest,
    ResetPasswordRequest,
    VerifyOTPRequest,
)
from app.schemas.common import MessageResponse
from app.schemas.user import UserResponse
from app.services.auth_service import get_auth_service
from app.services.email_service import get_email_service
from app.services.otp_service import get_otp_service
from app.services.user_service import get_user_service

router = APIRouter(prefix="/auth", tags=["Authentication"])

settings = get_settings()


# ── Cookie helpers ────────────────────────────────────────────────────

def _set_auth_cookies(
    response: Response,
    access_token: str,
    refresh_token: str,
) -> None:
    """Set httpOnly cookies for access and refresh tokens, plus a CSRF cookie."""
    is_prod = settings.ENVIRONMENT == "production"
    # Cross-site deploy: frontend (Vercel) and backend (Render) live on different
    # domains, so cookies must be ``SameSite=None`` + ``Secure`` in prod. The
    # modern browser requirement of "None" necessitates HTTPS (Render terminates
    # TLS, so this is satisfied). Dev keeps ``SameSite=Lax`` for local tunnels.
    same_site = "none" if is_prod else "lax"
    secure = is_prod

    # Access token — short-lived, sent on every request
    response.set_cookie(
        key="cc_access_token",
        value=access_token,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        httponly=True,
        secure=secure,
        samesite=same_site,
        path="/",
    )

    # Refresh token — long-lived, only sent to the refresh endpoint
    response.set_cookie(
        key="cc_refresh_token",
        value=refresh_token,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        httponly=True,
        secure=secure,
        samesite=same_site,
        path="/api/v1/auth/refresh",
    )

    # CSRF token — readable by JavaScript so it can be sent as a header.
    # This is the "submit" half of the double-submit pattern; the matching
    # validation lives in ``app.core.csrf.CsrfMiddleware``, which compares
    # this cookie to the ``X-CSRF-Token`` header on every cookie-authed,
    # state-changing request.
    csrf_token = secrets.token_hex(32)
    response.set_cookie(
        key="cc_csrf",
        value=csrf_token,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        httponly=False,
        secure=secure,
        samesite=same_site,
        path="/",
    )


def _clear_auth_cookies(response: Response) -> None:
    """Clear all auth-related cookies on logout."""
    is_prod = settings.ENVIRONMENT == "production"
    samesite = "none" if is_prod else "lax"
    secure = is_prod
    response.delete_cookie("cc_access_token", path="/", samesite=samesite, secure=secure)
    response.delete_cookie("cc_refresh_token", path="/api/v1/auth/refresh", samesite=samesite, secure=secure)
    response.delete_cookie("cc_csrf", path="/", samesite=samesite, secure=secure)


# ── Routes ────────────────────────────────────────────────────────────

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
    response: Response,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit(max_requests=10, window_seconds=60)),
) -> AuthResponse:
    """
    Verify the user's email address using the 6-digit OTP code.

    On success, the account is activated and JWT tokens are returned
    in httpOnly cookies.
    """
    auth_service = get_auth_service()
    result = await auth_service.verify_email(data, db)
    _set_auth_cookies(response, result.access_token, result.refresh_token)
    return result


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
    from app.worker.enqueue import enqueue_job
    await enqueue_job(
        "send_otp_email_job",
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
    response: Response,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit(max_requests=10, window_seconds=60)),
) -> AuthResponse:
    """
    Authenticate with email and password.

    Returns JWT access and refresh tokens in httpOnly cookies along
    with user data. The user must have a verified email to log in.
    """
    auth_service = get_auth_service()
    result = await auth_service.login(data, db)
    _set_auth_cookies(response, result.access_token, result.refresh_token)
    return result


@router.post(
    "/refresh",
    response_model=None,
    summary="Refresh access token",
)
async def refresh(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit(max_requests=10, window_seconds=60)),
) -> dict:
    """
    Exchange a valid refresh token for a new access + refresh token pair.

    The refresh token is read from the ``cc_refresh_token`` httpOnly cookie.
    The old refresh token is revoked (token rotation). If a revoked
    token is reused, all sessions for the user are invalidated as a
    security measure.
    """
    refresh_token = request.cookies.get("cc_refresh_token")
    if not refresh_token:
        from app.core.exceptions import UnauthorizedException
        raise UnauthorizedException(detail="No refresh token provided.")

    auth_service = get_auth_service()
    result = await auth_service.refresh_token_raw(refresh_token, db)
    _set_auth_cookies(response, result.access_token, result.refresh_token)
    return {"message": "Token refreshed."}


@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="Log out",
)
async def logout(
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """
    Log out the current user by revoking all refresh tokens and
    clearing auth cookies.
    """
    auth_service = get_auth_service()
    await auth_service.logout(current_user.id, db)
    _clear_auth_cookies(response)
    return MessageResponse(message="Successfully logged out.")


@router.post(
    "/ws-token",
    response_model=None,
    summary="Get a short-lived WebSocket token",
)
async def get_ws_token(
    current_user: User = Depends(get_current_user),
    _: None = Depends(rate_limit(max_requests=30, window_seconds=60)),
) -> dict:
    """
    Issue a short-lived JWT (5 min) scoped to WebSocket connections only.

    This avoids exposing the long-lived access token in the WebSocket URL
    query string, which would leak it to server logs and browser history.
    """
    ws_token = create_ws_token(data={"sub": str(current_user.id)})
    return {"access_token": ws_token, "refresh_token": "", "token_type": "ws"}


# ── Mobile auth (token-based, no cookies) ─────────────────────────────

@router.post(
    "/mobile/login",
    response_model=None,
    summary="Mobile login (returns tokens in body)",
)
async def mobile_login(
    data: LoginRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit(max_requests=10, window_seconds=60)),
) -> dict:
    """
    Authenticate with email and password for mobile apps.

    Returns JWT access and refresh tokens in the response body (not cookies).
    Mobile apps should store tokens in secure storage (iOS Keychain / Android
    EncryptedSharedPreferences).
    """
    auth_service = get_auth_service()
    result = await auth_service.login(data, db)
    return {
        "access_token": result.access_token,
        "refresh_token": result.refresh_token,
        "token_type": "bearer",
        "user": result.user.model_dump(),
    }


@router.post(
    "/mobile/refresh",
    response_model=None,
    summary="Mobile token refresh",
)
async def mobile_refresh(
    data: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit(max_requests=10, window_seconds=60)),
) -> dict:
    """
    Exchange a valid refresh token for a new access + refresh token pair.

    Accepts the refresh token in the request body (not cookies).
    """
    auth_service = get_auth_service()
    result = await auth_service.refresh_token_raw(data.refresh_token, db)
    return {
        "access_token": result.access_token,
        "refresh_token": result.refresh_token,
        "token_type": result.token_type,
    }


@router.post(
    "/mobile/logout",
    response_model=MessageResponse,
    summary="Mobile logout",
)
async def mobile_logout(
    data: RefreshTokenRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """
    Revoke a refresh token for mobile apps.
    """
    from app.services.auth_service import get_auth_service
    auth_service = get_auth_service()
    await auth_service.revoke_refresh_token(data.refresh_token, db)
    return MessageResponse(message="Successfully logged out.")


@router.post(
    "/mobile/push-token",
    response_model=MessageResponse,
    summary="Register push notification token",
)
async def register_push_token(
    data: PushTokenRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """
    Store the Expo push token for the authenticated user.

    The mobile app should call this endpoint after obtaining a push token
    from Expo Push Notifications service. The token is sent as a JSON body
    (not a query param) so it never lands in access logs.
    """
    from app.models.user import UserPushToken

    # Check if token already exists for this user
    existing = await db.execute(
        select(UserPushToken).where(
            UserPushToken.user_id == current_user.id,
            UserPushToken.token == data.push_token,
        )
    )
    if existing.scalar_one_or_none():
        return MessageResponse(message="Push token already registered.")

    # Store new push token
    new_token = UserPushToken(
        user_id=current_user.id,
        token=data.push_token,
        platform=data.platform,
    )
    db.add(new_token)
    await db.commit()

    return MessageResponse(message="Push token registered successfully.")


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
