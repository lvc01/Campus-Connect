"""
Application configuration loaded from environment variables.

Uses pydantic-settings to validate and type-cast all configuration
values at startup, failing fast if required variables are missing.
"""

import logging
from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    """Central application settings sourced from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @model_validator(mode="after")
    def _reject_default_secrets(self) -> "Settings":
        if self.JWT_ACCESS_SECRET == "change-me-access-secret-key":
            raise ValueError(
                "JWT_ACCESS_SECRET is still set to the default insecure value. "
                "Set a strong secret in your .env file before running in production."
            )
        if self.JWT_REFRESH_SECRET == "change-me-refresh-secret-key":
            raise ValueError(
                "JWT_REFRESH_SECRET is still set to the default insecure value. "
                "Set a strong secret in your .env file before running in production."
            )
        return self

    # ── Operational toggles ────────────────────────────────────────────
    # Set APPLY_PROD_GUARDS=false to skip the production-mode validation
    # in ``_validate_production_safety``. Useful for demos on free-tier
    # hosts (e.g. Render) where SMTP / S3 / Redis aren't configured yet.
    APPLY_PROD_GUARDS: bool = True

    # ── Database ──────────────────────────────────────────────────────
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/campus_connect"

    # ── Redis ─────────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_ENABLED: bool = True

    # ── JWT ───────────────────────────────────────────────────────────
    JWT_ACCESS_SECRET: str = "change-me-access-secret-key"
    JWT_REFRESH_SECRET: str = "change-me-refresh-secret-key"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── University ────────────────────────────────────────────────────
    ALLOWED_EMAIL_DOMAINS: str = "cuchd.in"

    # ── OTP ───────────────────────────────────────────────────────────
    OTP_DELIVERY_METHOD: str = "console"
    OTP_EXPIRE_MINUTES: int = 10
    OTP_MAX_ATTEMPTS: int = 5

    # ── Account lockout ────────────────────────────────────────────────
    ACCOUNT_LOCKOUT_THRESHOLD: int = 5
    ACCOUNT_LOCKOUT_MINUTES: int = 15

    # ── Error tracking ─────────────────────────────────────────────────
    SENTRY_DSN: str = ""

    # ── WebSocket ──────────────────────────────────────────────────────
    WS_TOKEN_EXPIRE_MINUTES: int = 5

    # ── SMTP ──────────────────────────────────────────────────────────
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = "noreply@campusconnect.co.za"

    # ── CORS ──────────────────────────────────────────────────────────
    CORS_ORIGINS: str = "http://localhost:3000"

    # ── Uploads ────────────────────────────────────────────────────────
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_SIZE_MB: int = 50
    MAX_TOTAL_UPLOAD_BYTES: int = 500 * 1024 * 1024  # 500 MB per user
    
    # ── Storage (S3 / Local) ───────────────────────────────────────────
    STORAGE_PROVIDER: str = "local"  # "local" or "s3"
    S3_ENDPOINT_URL: str | None = None
    S3_ACCESS_KEY: str | None = None
    S3_SECRET_KEY: str | None = None
    S3_BUCKET_NAME: str | None = None
    S3_PUBLIC_URL_PREFIX: str | None = None

    # ── Meilisearch ───────────────────────────────────────────────────
    MEILI_HOST: str | None = None
    MEILI_API_KEY: str | None = None

    # ── App ───────────────────────────────────────────────────────────
    APP_NAME: str = "CU Campus Connect"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    @model_validator(mode="after")
    def _production_requires_debug_off(self) -> "Settings":
        if self.ENVIRONMENT == "production" and self.DEBUG:
            raise ValueError(
                "DEBUG must be False when ENVIRONMENT=production. "
                "Set DEBUG=false in your .env file."
            )
        return self

    @model_validator(mode="after")
    def _production_invariants(self) -> "Settings":
        """Enforce production-only safety invariants.

        These prevent accidental misconfigurations that would expose
        development-only features (console OTP, local storage, default
        DB credentials) in a production environment.
        """
        if self.ENVIRONMENT != "production":
            return self
        if not self.APPLY_PROD_GUARDS:
            return self

        errors: list[str] = []

        if self.OTP_DELIVERY_METHOD == "console":
            errors.append(
                "OTP_DELIVERY_METHOD cannot be 'console' in production — "
                "set it to 'smtp' so real emails are sent."
            )

        if self.STORAGE_PROVIDER == "local":
            errors.append(
                "STORAGE_PROVIDER must be 's3' in production — "
                "local file storage is not suitable for multi-instance deploys."
            )

        if not self.REDIS_ENABLED:
            errors.append(
                "REDIS_ENABLED must be true in production — "
                "rate limiting and WebSocket pub/sub require Redis."
            )

        if "postgres:password@" in self.DATABASE_URL:
            errors.append(
                "DATABASE_URL contains default credentials in production — "
                "set a strong POSTGRES_PASSWORD."
            )

        if self.DATABASE_URL == "postgresql+asyncpg://postgres:password@localhost:5432/campus_connect":
            errors.append(
                "DATABASE_URL is still the development default — "
                "set a production database URL."
            )

        if errors:
            raise ValueError(
                "Production configuration errors:\n" + "\n".join(f"  - {e}" for e in errors)
            )

        return self

    # ── Derived properties ────────────────────────────────────────────

    @property
    def allowed_email_domains_list(self) -> list[str]:
        """Return allowed email domains as a list of lowercase strings."""
        return [d.strip().lower() for d in self.ALLOWED_EMAIL_DOMAINS.split(",") if d.strip()]

    @property
    def cors_origins_list(self) -> list[str]:
        """Return CORS origins as a list."""
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance (created once per process)."""
    return Settings()
