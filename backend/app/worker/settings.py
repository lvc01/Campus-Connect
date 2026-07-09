"""
ARQ worker settings — defines the job queue, scheduled tasks, and worker config.

Run with: arq app.worker.settings.WorkerSettings
"""

from arq.connections import RedisSettings

from app.config import get_settings
from app.worker.jobs import send_otp_email_job, send_notification_job, reindex_meilisearch


class WorkerSettings:
    """ARQ worker configuration."""

    functions = [
        send_otp_email_job,
        send_notification_job,
        reindex_meilisearch,
    ]

    # Redis connection — read from app settings
    def __init_subclass__(cls, **kwargs):
        super().__init_subclass__(**kwargs)
        settings = get_settings()
        cls.RedisSettings = RedisSettings.from_dsn(settings.REDIS_URL)

    # Worker tuning
    max_jobs = 10
    job_timeout = 30  # seconds
    keep_result = 3600  # keep job results for 1 hour
    max_tries = 3
    retry_delay = 60  # seconds between retries

    # Queue name
    queue_name = "arq:queue"
