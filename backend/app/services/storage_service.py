"""
Storage service for uploading files.

Supports both local filesystem (development) and S3/MinIO (production/staging).
"""

import logging
import re
import uuid
from pathlib import Path

import aioboto3
from fastapi import UploadFile

from app.config import get_settings
from app.core.exceptions import AppException

logger = logging.getLogger(__name__)

# user_id is used as a path segment; reject anything that isn't a UUID before
# interpolating it. Without this, a malformed JWT ``sub`` could attempt to
# escape the upload directory (e.g. ``../../etc``).
_SAFE_PATH_SEGMENT = re.compile(r"^[0-9a-fA-F-]{8,64}$")


class StorageService:
    def __init__(self) -> None:
        self.settings = get_settings()

    async def upload_file(self, file: UploadFile, user_id: str) -> str:
        """Upload a file and return its public URL."""
        if not _SAFE_PATH_SEGMENT.match(user_id or ""):
            raise AppException(detail="Invalid user identifier for upload.")

        # Generate a unique filename: <user_id>/<uuid>.<ext>
        ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else ""
        unique_name = f"{user_id}/{uuid.uuid4().hex}.{ext}" if ext else f"{user_id}/{uuid.uuid4().hex}"

        content = await file.read()
        await file.seek(0)

        if self.settings.STORAGE_PROVIDER == "s3":
            return await self._upload_to_s3(unique_name, content, file.content_type)
        else:
            return await self._upload_to_local(unique_name, content)

    async def _upload_to_s3(self, object_name: str, content: bytes, content_type: str | None) -> str:
        session = aioboto3.Session()
        try:
            async with session.client(
                "s3",
                endpoint_url=self.settings.S3_ENDPOINT_URL,
                aws_access_key_id=self.settings.S3_ACCESS_KEY,
                aws_secret_access_key=self.settings.S3_SECRET_KEY,
            ) as s3_client:
                await s3_client.put_object(
                    Bucket=self.settings.S3_BUCKET_NAME,
                    Key=object_name,
                    Body=content,
                    ContentType=content_type or "application/octet-stream",
                )
            
            # Construct public URL
            prefix = self.settings.S3_PUBLIC_URL_PREFIX.rstrip("/") if self.settings.S3_PUBLIC_URL_PREFIX else self.settings.S3_ENDPOINT_URL
            return f"{prefix}/{object_name}"
        except Exception as e:
            logger.error(f"S3 upload failed: {e}", exc_info=True)
            raise AppException(detail="Failed to upload file to storage.")

    async def _upload_to_local(self, object_name: str, content: bytes) -> str:
        upload_dir = Path(self.settings.UPLOAD_DIR)
        file_path = upload_dir / object_name
        
        # Ensure user directory exists
        file_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(file_path, "wb") as f:
            f.write(content)
            
        # The backend serves files from /uploads/
        return f"/uploads/{object_name}"


def get_storage_service() -> StorageService:
    return StorageService()
