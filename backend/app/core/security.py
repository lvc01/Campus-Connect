import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from jwt.exceptions import InvalidTokenError as JWTError

from app.config import get_settings
from app.core.exceptions import UnauthorizedException

settings = get_settings()

# ── Password hashing ─────────────────────────────────────────────────


def hash_password(password: str) -> str:
    """Hash a plain-text password using bcrypt."""
    password_bytes = password.encode("utf-8")[:72]  # bcrypt 72-byte limit
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password_bytes, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain-text password against a bcrypt hash."""
    password_bytes = plain_password.encode("utf-8")[:72]
    hashed_bytes = hashed_password.encode("utf-8")
    return bcrypt.checkpw(password_bytes, hashed_bytes)


# ── JWT tokens ────────────────────────────────────────────────────────

def create_access_token(
    data: dict,
    expires_delta: timedelta | None = None,
) -> str:
    """
    Create a short-lived JWT access token.

    The ``sub`` claim should contain the user ID as a string.
    An explicit ``type: access`` claim prevents refresh tokens
    from being used as access tokens.
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({
        "exp": expire,
        "type": "access",
        "jti": secrets.token_hex(16),
    })
    return jwt.encode(to_encode, settings.JWT_ACCESS_SECRET, algorithm="HS256")


def create_refresh_token(
    data: dict,
    expires_delta: timedelta | None = None,
) -> str:
    """
    Create a long-lived JWT refresh token.

    Uses a separate secret from the access token to prevent
    cross-token forgery.
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    )
    to_encode.update({
        "exp": expire,
        "type": "refresh",
        "jti": secrets.token_hex(16),
    })
    return jwt.encode(to_encode, settings.JWT_REFRESH_SECRET, algorithm="HS256")


def decode_token(token: str, token_type: str = "access") -> dict:
    """
    Decode and validate a JWT token.

    Supports ``access``, ``refresh``, and ``ws`` token types.
    ``access`` and ``ws`` tokens are both signed with the access secret;
    ``refresh`` tokens use the refresh secret.

    Raises ``UnauthorizedException`` if the token is expired, invalid,
    or has a mismatched ``type`` claim.
    """
    secret = (
        settings.JWT_ACCESS_SECRET
        if token_type in ("access", "ws")
        else settings.JWT_REFRESH_SECRET
    )
    try:
        payload = jwt.decode(token, secret, algorithms=["HS256"])
    except JWTError:
        raise UnauthorizedException(detail="Invalid or expired token.")

    if payload.get("type") != token_type:
        raise UnauthorizedException(detail="Invalid token type.")

    return payload


# ── OTP generation & hashing ──────────────────────────────────────────

def generate_otp() -> str:
    """Generate a cryptographically secure 6-digit OTP string."""
    return str(secrets.randbelow(900000) + 100000)


def hash_otp(code: str) -> str:
    """Return the SHA-256 hex digest of an OTP for safe DB storage."""
    return hashlib.sha256(code.encode()).hexdigest()


def create_ws_token(data: dict) -> str:
    """Create a short-lived JWT specifically for WebSocket authentication.

    Signed with the access secret but carries ``type: "ws"`` so it
    cannot be used for REST API calls or token refresh.
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.WS_TOKEN_EXPIRE_MINUTES
    )
    to_encode.update({
        "exp": expire,
        "type": "ws",
        "jti": secrets.token_hex(16),
    })
    return jwt.encode(to_encode, settings.JWT_ACCESS_SECRET, algorithm="HS256")


# ── Token hashing (for refresh token storage) ────────────────────────

def hash_token(token: str) -> str:
    """Return the SHA-256 hex digest of a token for safe DB storage."""
    return hashlib.sha256(token.encode()).hexdigest()
