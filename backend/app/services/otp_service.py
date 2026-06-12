"""
OTP lifecycle service — generation, storage, and validation.

OTPs are single-use 6-digit codes with a configurable expiry and
a maximum attempt count to prevent brute-force attacks.
"""

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.security import generate_otp, hash_otp
from app.models.user import OTPCode, OTPPurpose


def _utcnow() -> datetime:
    """Return the current UTC time as a timezone-aware datetime."""
    return datetime.now(timezone.utc)


class OTPService:
    """Handles OTP creation and verification against the database."""

    def __init__(self) -> None:
        self.settings = get_settings()

    async def create_otp(
        self,
        user_id: uuid.UUID,
        purpose: OTPPurpose,
        db: AsyncSession,
    ) -> str:
        """
        Generate a new OTP for the given user and purpose.

        Any existing unused OTPs for the same user+purpose combination
        are invalidated before creating a new one to prevent confusion.

        Args:
            user_id: ID of the user requesting the OTP.
            purpose: Why the OTP is being generated.
            db: Async database session.

        Returns:
            The 6-digit OTP string.
        """
        # Invalidate previous unused OTPs for this user + purpose
        await db.execute(
            update(OTPCode)
            .where(
                OTPCode.user_id == user_id,
                OTPCode.purpose == purpose,
                OTPCode.is_used == False,  # noqa: E712
            )
            .values(is_used=True)
        )

        otp = generate_otp()
        expires_at = _utcnow() + timedelta(
            minutes=self.settings.OTP_EXPIRE_MINUTES
        )

        otp_record = OTPCode(
            user_id=user_id,
            code=hash_otp(otp),
            purpose=purpose,
            expires_at=expires_at,
        )
        db.add(otp_record)
        await db.flush()

        return otp

    async def verify_otp(
        self,
        user_id: uuid.UUID,
        code: str,
        purpose: OTPPurpose,
        db: AsyncSession,
    ) -> bool:
        """
        Validate an OTP code for the given user and purpose.

        Checks:
            1. An unused OTP exists for this user + purpose.
            2. The OTP has not expired.
            3. The attempt count is below the maximum.
            4. The code matches.

        On a correct match the OTP is marked as used. On each attempt
        (correct or not) the attempt counter is incremented.

        Args:
            user_id: ID of the user attempting verification.
            code: The 6-digit code entered by the user.
            purpose: The expected OTP purpose.
            db: Async database session.

        Returns:
            ``True`` if the OTP is valid; ``False`` otherwise.
        """
        result = await db.execute(
            select(OTPCode)
            .where(
                OTPCode.user_id == user_id,
                OTPCode.purpose == purpose,
                OTPCode.is_used == False,  # noqa: E712
            )
            .order_by(OTPCode.created_at.desc())
            .limit(1)
        )
        otp_record = result.scalar_one_or_none()

        if otp_record is None:
            return False

        # Check expiry
        expires = otp_record.expires_at
        now = _utcnow()
        # Handle mixed tz-aware/naive comparisons (e.g. SQLite vs PostgreSQL)
        if now.tzinfo is not None and (not hasattr(expires, 'tzinfo') or expires.tzinfo is None):
            now = now.replace(tzinfo=None)
        elif (not hasattr(now, 'tzinfo') or now.tzinfo is None) and hasattr(expires, 'tzinfo') and expires.tzinfo is not None:
            expires = expires.replace(tzinfo=None)
        if now > expires:
            otp_record.is_used = True  # Expire it
            await db.flush()
            return False

        # Check attempt limit
        if otp_record.attempts >= self.settings.OTP_MAX_ATTEMPTS:
            otp_record.is_used = True  # Lock it out
            await db.flush()
            return False

        # Increment attempts
        otp_record.attempts += 1

        # Verify code (compare hashes — plaintext is never stored)
        if otp_record.code != hash_otp(code):
            await db.flush()
            return False

        # Success — mark as used
        otp_record.is_used = True
        await db.flush()
        return True

    async def get_last_otp_created_at(
        self,
        user_id: uuid.UUID,
        purpose: OTPPurpose,
        db: AsyncSession,
    ) -> datetime | None:
        """
        Get the creation timestamp of the most recent OTP for rate-limiting.

        Returns:
            The ``created_at`` datetime or ``None`` if no OTP exists.
        """
        result = await db.execute(
            select(OTPCode.created_at)
            .where(
                OTPCode.user_id == user_id,
                OTPCode.purpose == purpose,
            )
            .order_by(OTPCode.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()


def get_otp_service() -> OTPService:
    """Return an OTPService instance."""
    return OTPService()
