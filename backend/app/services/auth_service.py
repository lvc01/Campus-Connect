"""
Authentication service — registration, login, token management.

Orchestrates the user, OTP, and email services to implement the
full auth lifecycle from sign-up through token refresh and logout.
"""

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload


def _utcnow() -> datetime:
    """Naive UTC now — avoids offset-naive/aware mismatches with SQLite."""
    return datetime.now(timezone.utc).replace(tzinfo=None)

from app.config import get_settings
from app.core.exceptions import (
    BadRequestException,
    ConflictException,
    ForbiddenException,
    UnauthorizedException,
)
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    hash_token,
    verify_password,
)
from app.models.user import OTPPurpose, Profile, RefreshToken, User
from app.schemas.auth import (
    AuthResponse,
    ForgotPasswordRequest,
    LoginRequest,
    RefreshTokenRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    VerifyOTPRequest,
)
from app.schemas.common import MessageResponse
from app.schemas.user import UserResponse
from app.services.email_service import get_email_service
from app.services.otp_service import get_otp_service
from app.utils.validators import validate_email_domain


class AuthService:
    """Handles registration, login, and token lifecycle."""

    def __init__(self) -> None:
        self.settings = get_settings()
        self.otp_service = get_otp_service()
        self.email_service = get_email_service()

    # ── Registration ──────────────────────────────────────────────────

    async def register(
        self,
        data: RegisterRequest,
        db: AsyncSession,
    ) -> dict:
        """
        Register a new user with a university email.

        Steps:
            1. Validate email domain against allowed list.
            2. Check for duplicate email.
            3. Create User + Profile records.
            4. Generate and send OTP for email verification.

        Args:
            data: Validated registration payload.
            db: Async database session.

        Returns:
            A dict with a success message.

        Raises:
            BadRequestException: If the email domain is not allowed.
            ConflictException: If the email is already registered.
        """
        self._validate_email_domain(data.email)

        # Check duplicate
        existing = await db.execute(
            select(User).where(User.email == data.email.lower())
        )
        if existing.scalar_one_or_none() is not None:
            raise ConflictException(detail="An account with this email already exists.")

        # Create user
        user = User(
            email=data.email.lower(),
            hashed_password=hash_password(data.password),
        )
        db.add(user)
        await db.flush()

        # Create profile
        profile = Profile(
            user_id=user.id,
            display_name=data.display_name,
            faculty=data.faculty,
            year_of_study=data.year_of_study,
        )
        db.add(profile)
        await db.flush()

        # Generate and send OTP
        otp = await self.otp_service.create_otp(
            user_id=user.id,
            purpose=OTPPurpose.email_verification,
            db=db,
        )
        await self.email_service.send_otp_email(
            to=user.email,
            otp=otp,
            purpose="Email Verification",
        )

        result = {"message": "Registration successful. Please check your email for the OTP verification code."}
        if self.settings.OTP_DELIVERY_METHOD == "console":
            result["dev_otp"] = otp
        return result

    # ── Email verification ────────────────────────────────────────────

    async def verify_email(
        self,
        data: VerifyOTPRequest,
        db: AsyncSession,
    ) -> AuthResponse:
        """
        Verify a user's email with the OTP code and issue tokens.

        Args:
            data: Email and OTP code.
            db: Async database session.

        Returns:
            Auth response with tokens and user data.

        Raises:
            BadRequestException: If the OTP is invalid or expired.
        """
        user = await self._get_user_by_email(data.email, db)
        if user is None:
            raise BadRequestException(detail="No account found with this email.")

        if user.is_verified:
            raise BadRequestException(detail="Email is already verified.")

        is_valid = await self.otp_service.verify_otp(
            user_id=user.id,
            code=data.code,
            purpose=OTPPurpose.email_verification,
            db=db,
        )
        if not is_valid:
            raise BadRequestException(detail="Invalid or expired OTP code.")

        user.is_verified = True
        await db.flush()

        access_token, refresh_token = await self._create_token_pair(user.id, db)

        # Reload user with profile
        await db.refresh(user, attribute_names=["profile"])

        return AuthResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            user=UserResponse.model_validate(user),
        )

    # ── Login ─────────────────────────────────────────────────────────

    async def login(
        self,
        data: LoginRequest,
        db: AsyncSession,
    ) -> AuthResponse:
        """
        Authenticate a verified user and issue JWT tokens.

        Enforces account lockout after ``ACCOUNT_LOCKOUT_THRESHOLD``
        consecutive failed attempts. Locked accounts cannot log in until
        ``locked_until`` passes or an admin intervenes.

        Args:
            data: Email and password.
            db: Async database session.

        Returns:
            Auth response with tokens and user data.

        Raises:
            UnauthorizedException: If credentials are invalid or account is locked.
            ForbiddenException: If the user hasn't verified their email.
        """
        user = await self._get_user_by_email(data.email, db)
        if user is None:
            raise UnauthorizedException(detail="Invalid email or password.")

        # Check lockout
        if user.locked_until is not None:
            locked_until = user.locked_until
            if hasattr(locked_until, 'tzinfo') and locked_until.tzinfo is not None:
                locked_until = locked_until.replace(tzinfo=None)
            if _utcnow() < locked_until:
                remaining = int((locked_until - _utcnow()).total_seconds())
                raise UnauthorizedException(
                    detail=f"Account is temporarily locked. Try again in {remaining} seconds."
                )
            # Lockout period has passed — reset counter
            user.failed_login_attempts = 0
            user.locked_until = None

        if not verify_password(data.password, user.hashed_password):
            # Increment failure counter
            user.failed_login_attempts += 1
            threshold = getattr(self.settings, "ACCOUNT_LOCKOUT_THRESHOLD", 5)
            if user.failed_login_attempts >= threshold:
                lock_minutes = getattr(self.settings, "ACCOUNT_LOCKOUT_MINUTES", 15)
                user.locked_until = _utcnow() + timedelta(minutes=lock_minutes)
            await db.flush()
            raise UnauthorizedException(detail="Invalid email or password.")

        if not user.is_verified:
            raise ForbiddenException(detail="Please verify your email before logging in.")

        if not user.is_active:
            raise UnauthorizedException(detail="Your account has been deactivated.")

        # Successful login — reset failure counter
        user.failed_login_attempts = 0
        user.locked_until = None
        await db.flush()

        access_token, refresh_token = await self._create_token_pair(user.id, db)

        return AuthResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            user=UserResponse.model_validate(user),
        )

    # ── Token refresh ─────────────────────────────────────────────────

    async def refresh_token(
        self,
        data: RefreshTokenRequest,
        db: AsyncSession,
    ) -> TokenResponse:
        """
        Issue a new token pair using a valid refresh token (rotation).

        The old refresh token is revoked and a new pair is issued.
        This prevents replay attacks if a refresh token is stolen.

        Args:
            data: The current refresh token.
            db: Async database session.

        Returns:
            New access + refresh token pair.

        Raises:
            UnauthorizedException: If the refresh token is invalid or revoked.
        """
        payload = decode_token(data.refresh_token, token_type="refresh")
        user_id_str = payload.get("sub")
        if user_id_str is None:
            raise UnauthorizedException(detail="Invalid refresh token.")

        user_id = uuid.UUID(user_id_str)
        token_hash_value = hash_token(data.refresh_token)

        # Find the stored refresh token
        result = await db.execute(
            select(RefreshToken).where(
                RefreshToken.token_hash == token_hash_value,
                RefreshToken.user_id == user_id,
            )
        )
        stored_token = result.scalar_one_or_none()

        if stored_token is None:
            raise UnauthorizedException(detail="Refresh token not found.")
        if stored_token.is_revoked:
            # Possible token reuse attack — revoke ALL tokens for this user
            await db.execute(
                update(RefreshToken)
                .where(RefreshToken.user_id == user_id)
                .values(is_revoked=True)
            )
            await db.flush()
            raise UnauthorizedException(detail="Refresh token has been revoked. All sessions invalidated.")

        expires_at = stored_token.expires_at
        if hasattr(expires_at, 'tzinfo') and expires_at.tzinfo is not None:
            expires_at = expires_at.replace(tzinfo=None)
        if _utcnow() > expires_at:
            raise UnauthorizedException(detail="Refresh token has expired.")

        # Revoke old token
        stored_token.is_revoked = True
        await db.flush()

        # Issue new pair
        access_token, new_refresh_token = await self._create_token_pair(user_id, db)

        return TokenResponse(
            access_token=access_token,
            refresh_token=new_refresh_token,
        )

    # ── Logout ────────────────────────────────────────────────────────

    async def logout(
        self,
        user_id: uuid.UUID,
        db: AsyncSession,
    ) -> None:
        """
        Revoke all refresh tokens for the user, ending all sessions.

        Args:
            user_id: ID of the user logging out.
            db: Async database session.
        """
        await db.execute(
            update(RefreshToken)
            .where(
                RefreshToken.user_id == user_id,
                RefreshToken.is_revoked == False,  # noqa: E712
            )
            .values(is_revoked=True)
        )
        await db.flush()

    # ── Password reset ────────────────────────────────────────────────

    async def forgot_password(
        self,
        data: ForgotPasswordRequest,
        db: AsyncSession,
    ) -> MessageResponse:
        """
        Send a password-reset OTP to the user's email.

        For security, the response is the same whether or not the email
        exists — an attacker cannot enumerate registered addresses.

        Args:
            data: Email address to send the reset OTP to.
            db: Async database session.

        Returns:
            A generic success message.
        """
        user = await self._get_user_by_email(data.email, db)
        dev_otp = None
        if user is not None:
            otp = await self.otp_service.create_otp(
                user_id=user.id,
                purpose=OTPPurpose.password_reset,
                db=db,
            )
            await self.email_service.send_otp_email(
                to=user.email,
                otp=otp,
                purpose="Password Reset",
            )
            if self.settings.OTP_DELIVERY_METHOD == "console":
                dev_otp = otp
        return MessageResponse(
            message="If an account with this email exists, a password reset code has been sent.",
            dev_otp=dev_otp,
        )

    async def reset_password(
        self,
        data: ResetPasswordRequest,
        db: AsyncSession,
    ) -> MessageResponse:
        """
        Reset a user's password using the OTP code from their email.

        On success the password is updated and all existing sessions
        are terminated (all refresh tokens revoked).

        Args:
            data: Email, OTP code, and new password.
            db: Async database session.

        Returns:
            A success message.

        Raises:
            BadRequestException: If the OTP is invalid or the email
                does not belong to a registered user.
        """
        user = await self._get_user_by_email(data.email, db)
        if user is None:
            raise BadRequestException(detail="No account found with this email.")

        is_valid = await self.otp_service.verify_otp(
            user_id=user.id,
            code=data.code,
            purpose=OTPPurpose.password_reset,
            db=db,
        )
        if not is_valid:
            raise BadRequestException(
                detail="Invalid or expired reset code. Please request a new one."
            )

        user.hashed_password = hash_password(data.new_password)
        await db.flush()

        # Terminate all sessions
        await self.logout(user.id, db)

        return MessageResponse(
            message="Password has been reset successfully. You can now log in with your new password."
        )

    # ── Private helpers ───────────────────────────────────────────────

    async def _create_token_pair(
        self,
        user_id: uuid.UUID,
        db: AsyncSession,
    ) -> tuple[str, str]:
        """
        Generate an access + refresh token pair and persist the refresh hash.

        Returns:
            Tuple of (access_token, refresh_token) strings.
        """
        access_token = create_access_token(data={"sub": str(user_id)})
        refresh_token = create_refresh_token(data={"sub": str(user_id)})

        # Store refresh token hash
        stored = RefreshToken(
            user_id=user_id,
            token_hash=hash_token(refresh_token),
            expires_at=_utcnow()
            + timedelta(days=self.settings.REFRESH_TOKEN_EXPIRE_DAYS),
        )
        db.add(stored)
        await db.flush()

        return access_token, refresh_token

    def _validate_email_domain(self, email: str) -> None:
        """Raise ``BadRequestException`` if the email domain is not whitelisted."""
        if not validate_email_domain(email, self.settings.allowed_email_domains_list):
            allowed = ", ".join(self.settings.allowed_email_domains_list)
            raise BadRequestException(
                detail=f"Only university email addresses are allowed. Accepted domains: {allowed}"
            )

    async def _get_user_by_email(
        self,
        email: str,
        db: AsyncSession,
    ) -> User | None:
        """Fetch a user by email with profile eager-loaded."""
        result = await db.execute(
            select(User)
            .options(selectinload(User.profile))
            .where(User.email == email.lower(), User.deleted_at.is_(None))
        )
        return result.scalar_one_or_none()


def get_auth_service() -> AuthService:
    """Return an AuthService instance."""
    return AuthService()
