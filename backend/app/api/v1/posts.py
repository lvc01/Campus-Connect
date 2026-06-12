import uuid
from pathlib import Path

import magic
from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import BadRequestException, NotFoundException
from app.core.rate_limiter import rate_limit
from app.models.notification import NotificationType
from app.models.post import Post
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.moderation import ReportCreate
from app.schemas.post import CommentCreate, CommentResponse, FeedResponse, PostCreate, PostResponse, PostUpdate, VoteRequest
from app.services.notification_service import get_notification_service
from app.services.post_service import get_post_service
from app.services.storage_service import get_storage_service

router = APIRouter(prefix="/posts", tags=["Posts"])

_settings = get_settings()
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "gif", "webp", "mp4", "webm", "mov"}

# Extension → expected MIME type (validated via libmagic)
EXTENSION_MIME_MAP: dict[str, set[str]] = {
    "jpg": {"image/jpeg"},
    "jpeg": {"image/jpeg"},
    "png": {"image/png"},
    "gif": {"image/gif"},
    "webp": {"image/webp"},
    "mp4": {"video/mp4"},
    "webm": {"video/webm"},
    "mov": {"video/quicktime"},
}

MEDIA_TYPE_MAP: dict[str, str] = {
    "jpg": "image", "jpeg": "image", "png": "image",
    "gif": "image", "webp": "image",
    "mp4": "video", "webm": "video", "mov": "video",
}

MAX_FILE_SIZE = _settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024


@router.post(
    "/upload",
    status_code=status.HTTP_200_OK,
    summary="Upload a media file",
)
async def upload_media(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit(max_requests=5, window_seconds=60)),
) -> dict:
    """Upload an image or video file. Returns the public URL.

    Validates:
        - File extension is in the allowed list.
        - Actual MIME type (via libmagic) matches the extension.
        - File size is within the per-file limit.
        - User has not exceeded their total upload quota.
    """
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise BadRequestException(
            detail=f"File type '.{ext}' not allowed. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise BadRequestException(
            detail=f"File too large. Maximum size is {_settings.MAX_UPLOAD_SIZE_MB} MB."
        )

    # MIME type validation via libmagic
    detected_mime = magic.from_buffer(content, mime=True)
    expected_mimes = EXTENSION_MIME_MAP.get(ext, set())
    if detected_mime not in expected_mimes:
        raise BadRequestException(
            detail=f"File content does not match extension '.{ext}'. "
                   f"Detected MIME type: {detected_mime}."
        )

    # Check per-user quota
    new_total = (current_user.total_upload_bytes or 0) + len(content)
    if new_total > _settings.MAX_TOTAL_UPLOAD_BYTES:
        raise BadRequestException(
            detail="Upload quota exceeded. You have reached the maximum storage limit."
        )

    # Use Storage Service
    storage_service = get_storage_service()
    
    # We must reset the file pointer because we read it earlier
    await file.seek(0)
    public_url = await storage_service.upload_file(file, str(current_user.id))

    # Update user's total upload bytes
    await db.execute(
        update(User)
        .where(User.id == current_user.id)
        .values(total_upload_bytes=new_total)
    )
    await db.flush()

    return {"url": public_url, "type": "image" if ext in {"jpg", "jpeg", "png", "webp", "gif"} else "video"}


@router.post(
    "",
    response_model=PostResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new post",
)
async def create_post(
    data: PostCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit(max_requests=10, window_seconds=60)),
) -> PostResponse:
  """
  Create a new social post. 
  Hashtags are parsed from the body automatically.
  """
  post_service = get_post_service()
  post = await post_service.create_post(current_user.id, data, db)
  return PostResponse.model_validate(post)


@router.get(
    "",
    response_model=FeedResponse,
    summary="Get paginated feed of posts",
)
async def get_feed(
    cursor: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    faculty_only: bool = Query(default=False),
    club_id: uuid.UUID | None = Query(default=None),
    author_id: uuid.UUID | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FeedResponse:
  """
  Retrieve a paginated feed of posts sorted newest first.
  Implements strict campus visibility boundaries.
  """
  post_service = get_post_service()
  feed = await post_service.get_feed(
      current_user.id, cursor, limit, faculty_only, db, club_id=club_id, author_id=author_id
  )
  return FeedResponse.model_validate(feed)


@router.post(
    "/{post_id}/like",
    response_model=MessageResponse,
    summary="Like a post",
)
async def like_post(
    post_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
  """Like a post and update its count."""
  post_service = get_post_service()
  notification_service = get_notification_service()
  post = await db.execute(select(Post).where(Post.id == post_id))
  post_obj = post.scalar_one_or_none()
  await post_service.like_post(current_user.id, post_id, db)
  if post_obj and post_obj.author_id != current_user.id:
      await notification_service.create_notification(
          user_id=post_obj.author_id,
          type=NotificationType.like,
          title=f"{current_user.profile.display_name or current_user.email.split('@')[0]} liked your post",
          data={"post_id": str(post_id)},
          actor_id=current_user.id,
          db=db,
      )
  return MessageResponse(message="Post liked.")


@router.delete(
    "/{post_id}/like",
    response_model=MessageResponse,
    summary="Unlike a post",
)
async def unlike_post(
    post_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
  """Unlike a post and update its count."""
  post_service = get_post_service()
  await post_service.unlike_post(current_user.id, post_id, db)
  return MessageResponse(message="Post unliked.")


@router.post(
    "/{post_id}/save",
    response_model=MessageResponse,
    summary="Bookmark a post",
)
async def save_post(
    post_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
  """Bookmark/save a post to your board."""
  post_service = get_post_service()
  await post_service.save_post(current_user.id, post_id, db)
  return MessageResponse(message="Post bookmarked.")


@router.delete(
    "/{post_id}/save",
    response_model=MessageResponse,
    summary="Unbookmark a post",
)
async def unsave_post(
    post_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
  """Remove a post bookmark."""
  post_service = get_post_service()
  await post_service.unsave_post(current_user.id, post_id, db)
  return MessageResponse(message="Bookmark removed.")


@router.post(
    "/{post_id}/comments",
    response_model=CommentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a comment or reply to a post",
)
async def create_comment(
    post_id: uuid.UUID,
    data: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit(max_requests=10, window_seconds=60)),
) -> CommentResponse:
  """Add a comment or threaded comment reply."""
  post_service = get_post_service()
  notification_service = get_notification_service()
  comment = await post_service.create_comment(current_user.id, post_id, data, db)
  post = await db.execute(select(Post).where(Post.id == post_id))
  post_obj = post.scalar_one_or_none()
  if post_obj and post_obj.author_id != current_user.id:
      await notification_service.create_notification(
          user_id=post_obj.author_id,
          type=NotificationType.comment,
          title=f"{current_user.profile.display_name or current_user.email.split('@')[0]} commented on your post",
          body=data.content[:200] if data.content else None,
          data={"post_id": str(post_id), "comment_id": str(comment.id)},
          actor_id=current_user.id,
          db=db,
      )
  return CommentResponse.model_validate(comment)


@router.get(
    "/{post_id}/comments",
    response_model=list[CommentResponse],
    summary="Get all threaded comments for a post",
)
async def get_comments(
    post_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[CommentResponse]:
  """Retrieve a complete threaded comment tree for a post."""
  post_service = get_post_service()
  comments = await post_service.get_comments(post_id, db)
  return [CommentResponse.model_validate(c) for c in comments]


@router.delete(
    "/{post_id}/comments/{comment_id}",
    response_model=MessageResponse,
    summary="Delete a comment",
)
async def delete_comment(
    post_id: uuid.UUID,
    comment_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
  """Soft-delete your own comment. Also decrements the post comment count."""
  post_service = get_post_service()
  await post_service.delete_comment(current_user.id, post_id, comment_id, db)
  return MessageResponse(message="Comment deleted.")


@router.patch(
    "/{post_id}",
    response_model=PostResponse,
    summary="Update a post",
)
async def update_post(
    post_id: uuid.UUID,
    data: PostUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PostResponse:
  """Update your own post (content, visibility, tags)."""
  post_service = get_post_service()
  post = await post_service.update_post(current_user.id, post_id, data, db)
  return PostResponse.model_validate(post)


@router.delete(
    "/{post_id}",
    response_model=MessageResponse,
    summary="Delete a post",
)
async def delete_post(
    post_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
  """Soft-delete your own post."""
  post_service = get_post_service()
  await post_service.delete_post(current_user.id, post_id, db)
  return MessageResponse(message="Post deleted.")


@router.post(
    "/{post_id}/share",
    response_model=MessageResponse,
    summary="Share a post",
)
async def share_post(
    post_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
  """Share/repost a post."""
  post_service = get_post_service()
  await post_service.share_post(current_user.id, post_id, db)
  return MessageResponse(message="Post shared.")


@router.delete(
    "/{post_id}/share",
    response_model=MessageResponse,
    summary="Unshare a post",
)
async def unshare_post(
    post_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
  """Remove a share/repost."""
  post_service = get_post_service()
  await post_service.unshare_post(current_user.id, post_id, db)
  return MessageResponse(message="Share removed.")


@router.post(
    "/{post_id}/report",
    response_model=MessageResponse,
    summary="Report a post",
)
async def report_post(
    post_id: uuid.UUID,
    data: ReportCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
  """File a report against a post."""
  post_service = get_post_service()
  await post_service.report_post(current_user.id, post_id, data, db)
  return MessageResponse(message="Report filed. Moderators will review it shortly.")


@router.post(
    "/{post_id}/poll/vote",
    response_model=MessageResponse,
    summary="Vote on a poll",
)
async def vote_poll(
    post_id: uuid.UUID,
    data: VoteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
  """Cast or change a vote on a poll post."""
  post_service = get_post_service()
  await post_service.vote_poll(current_user.id, post_id, data.option_id, db)
  return MessageResponse(message="Vote recorded.")
