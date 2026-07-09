"""
Storage service for uploading files.

Supports both local filesystem (development) and S3/MinIO (production/staging).

Security measures:
  - User ID path segments validated against a strict regex (prevents traversal).
  - MIME / file-type validation via a content-sniffing allowlist.
  - Streaming writes to avoid loading entire files into memory (memory-DoS).
"""

import logging
import os
import re
import tempfile
import uuid
from pathlib import Path

import aioboto3
from fastapi import UploadFile

from app.config import get_settings
from app.core.exceptions import AppException, BadRequestException

logger = logging.getLogger(__name__)

# user_id is used as a path segment; reject anything that isn't a UUID-shaped
# hex string before interpolating it. Without this, a malformed JWT ``sub`` could
# attempt to escape the upload directory (e.g. ``../../etc``). A standard UUID
# (36 chars, with dashes) or a 32-char hex digest are both accepted.
_SAFE_PATH_SEGMENT = re.compile(r"^[0-9a-fA-F]{32}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$|^[0-9a-fA-F-]{36}$|^[0-9a-fA-F]{32}$")

# Allowed MIME types — extend as needed.  This list is deliberately
# restrictive; anything not here is rejected at upload time.
_ALLOWED_MIME_TYPES: frozenset[str] = frozenset({
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
})

# Magic-byte signatures for the allowed image types.  Each entry maps
# a MIME type to a list of possible byte prefixes.  The check is
# performed on the first 8 bytes of the file.
_MAGIC_BYTES: dict[str, list[bytes]] = {
    "image/jpeg": [b"\xff\xd8\xff"],
    "image/png": [b"\x89PNG\r\n\x1a\n"],
    "image/gif": [b"GIF87a", b"GIF89a"],
    "image/webp": [],  # WebP has RIFF header; check is more complex
    "application/pdf": [b"%PDF"],
}


def _sniff_mime_type(first_bytes: bytes) -> str | None:
    """Best-effort MIME sniffing from magic bytes. Returns None if unknown."""
    if first_bytes[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if first_bytes[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if first_bytes[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    if first_bytes[:4] == b"RIFF" and first_bytes[8:12] == b"WEBP":
        return "image/webp"
    if first_bytes[:4] == b"%PDF":
        return "application/pdf"
    return None


class StorageService:
    def __init__(self) -> None:
        self.settings = get_settings()

    async def upload_file(self, file: UploadFile, user_id: str) -> str:
        """Upload a file and return its public URL.

        Validates the file type against an allowlist of MIME types
        using both the declared content-type and magic-byte sniffing.
        Files are streamed to disk/S3 in 8 KB chunks to avoid loading
        the entire file into memory.
        """
        if not _SAFE_PATH_SEGMENT.match(user_id or ""):
            raise AppException(detail="Invalid user identifier for upload.")

        # ── MIME validation ────────────────────────────────────────────
        declared_mime = (file.content_type or "").lower()
        if declared_mime not in _ALLOWED_MIME_TYPES:
            raise BadRequestException(
                detail=f"File type '{declared_mime}' is not allowed. "
                       f"Accepted types: {', '.join(sorted(_ALLOWED_MIME_TYPES))}",
            )

        # Read first 8 bytes for magic-byte sniffing
        first_bytes = await file.read(8)
        await file.seek(0)

        sniffed = _sniff_mime_type(first_bytes)
        if sniffed is None:
            raise BadRequestException(
                detail="Could not verify file type. The file may be corrupted.",
            )
        if sniffed != declared_mime:
            raise BadRequestException(
                detail=f"Declared type '{declared_mime}' does not match file content ('{sniffed}').",
            )

        # ── Generate unique path ───────────────────────────────────────
        ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else ""
        unique_name = f"{user_id}/{uuid.uuid4().hex}.{ext}" if ext else f"{user_id}/{uuid.uuid4().hex}"

        if self.settings.STORAGE_PROVIDER == "s3":
            return await self._upload_to_s3(unique_name, file)
        else:
            return await self._upload_to_local(unique_name, file)

    async def _upload_to_s3(self, object_name: str, file: UploadFile) -> str:
        session = aioboto3.Session()
        try:
            async with session.client(
                "s3",
                endpoint_url=self.settings.S3_ENDPOINT_URL,
                aws_access_key_id=self.settings.S3_ACCESS_KEY,
                aws_secret_access_key=self.settings.S3_SECRET_KEY,
            ) as s3_client:
                # Stream to S3 via multipart upload
                await s3_client.upload_fileobj(
                    file.file,
                    self.settings.S3_BUCKET_NAME,
                    object_name,
                    ExtraArgs={"ContentType": file.content_type or "application/octet-stream"},
                )

            # Construct public URL
            prefix = self.settings.S3_PUBLIC_URL_PREFIX.rstrip("/") if self.settings.S3_PUBLIC_URL_PREFIX else self.settings.S3_ENDPOINT_URL
            return f"{prefix}/{object_name}"
        except Exception as e:
            logger.error("S3 upload failed: %s", e, exc_info=True)
            raise AppException(detail="Failed to upload file to storage.")

    async def _upload_to_local(self, object_name: str, file: UploadFile) -> str:
        upload_dir = Path(self.settings.UPLOAD_DIR)
        file_path = upload_dir / object_name

        # Ensure user directory exists
        file_path.parent.mkdir(parents=True, exist_ok=True)

        # Stream to a temp file first, then atomic rename (prevents partial writes)
        tmp_fd, tmp_path = tempfile.mkstemp(dir=upload_dir)
        try:
            with os.fdopen(tmp_fd, "wb") as tmp_file:
                while chunk := await file.read(8192):
                    tmp_file.write(chunk)
            Path(tmp_path).replace(file_path)
        except Exception:
            # Clean up temp file on failure
            try:
                Path(tmp_path).unlink(missing_ok=True)
            except Exception:
                pass
            raise

        # The backend serves files from /uploads/
        return f"/uploads/{object_name}"


def get_storage_service() -> StorageService:
    return StorageService()
