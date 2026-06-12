import re
import uuid
from datetime import datetime, timezone
from sqlalchemy import and_, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import BadRequestException, ForbiddenException, NotFoundException
from app.models.moderation import Report, ReportCategory, ReportTargetType
from app.models.post import Comment, Like, MediaType, PollOption, PollVote, Post, PostMedia, PostVisibility, Save, Share
from app.models.user import Profile, User
from app.schemas.moderation import ReportCreate
from app.schemas.post import CommentCreate, PostCreate, PostUpdate
from app.utils.pagination import paginate


class PostService:
  """Handles all feed post creation, liking, bookmarking, and threaded comments."""

  # ── Post Creation ──────────────────────────────────────────────────

  async def create_post(
      self,
      author_id: uuid.UUID,
      data: PostCreate,
      db: AsyncSession,
  ) -> Post:
    """
    Create a new post with optional hashtags and media attachments.
    """
    # Extract hashtags automatically from content if tags not provided
    tags = data.tags
    if tags is None and data.content:
      tags = list(set(re.findall(r"#(\w+)", data.content)))

    post = Post(
        author_id=author_id,
        content=data.content,
        post_type=data.post_type,
        visibility=data.visibility,
        tags=tags,
        club_id=data.club_id,
    )
    db.add(post)
    await db.flush()

    # Process poll options
    if data.poll_options:
      for opt in data.poll_options:
        poll_option = PollOption(
            post_id=post.id,
            text=opt.text,
            position=opt.position,
        )
        db.add(poll_option)
      await db.flush()

    # Process media attachments
    if data.media_urls:
      for index, url in enumerate(data.media_urls):
        # Basic media type inference from file extensions
        media_type = MediaType.image
        ext = url.split(".")[-1].lower() if "." in url else ""
        if ext in ["mp4", "webm", "mov"]:
          media_type = MediaType.video
        elif ext in ["pdf", "doc", "docx", "zip"]:
          media_type = MediaType.document

        media_attach = PostMedia(
            post_id=post.id,
            media_type=media_type,
            url=url,
            order=index,
        )
        db.add(media_attach)
      await db.flush()

    # Refresh to load author and media relationships
    result = await db.execute(
        select(Post)
        .options(
            selectinload(Post.author).selectinload(User.profile),
            selectinload(Post.media),
            selectinload(Post.poll_options),
        )
        .where(Post.id == post.id)
    )
    post = result.scalar_one()

    # Attach poll data for poll posts
    if post.post_type.value == "poll" and post.poll_options:
      total = sum(opt.vote_count for opt in post.poll_options)
      post._poll_data = {
          "options": post.poll_options,
          "total_votes": total,
          "user_vote_option_id": None,
      }
    else:
      post._poll_data = None

    return post

  # ── Feed Retrieval ──────────────────────────────────────────────────

  async def get_feed(
      self,
      user_id: uuid.UUID,
      cursor: str | None,
      limit: int,
      faculty_only: bool,
      db: AsyncSession,
      club_id: uuid.UUID | None = None,
      author_id: uuid.UUID | None = None,
  ) -> dict:
    """
    Retrieve a paginated feed of posts, observing visibility gates.
    """
    # 1. Recover the requesting user's faculty
    profile_result = await db.execute(
        select(Profile).where(Profile.user_id == user_id)
    )
    current_profile = profile_result.scalar_one_or_none()
    user_faculty = current_profile.faculty if current_profile else None

    # 2. Build the basic visibility filter query joining the author profile
    query = select(Post).outerjoin(Profile, Post.author_id == Profile.user_id)

    # Visibility constraints:
    # - Post is public
    # - Or requesting user is the post author
    # - Or post is faculty_only and author matches requesting user's faculty
    visibility_conditions = [
        Post.visibility == PostVisibility.public,
        Post.author_id == user_id,
    ]
    if user_faculty:
      visibility_conditions.append(
          and_(
              Post.visibility == PostVisibility.faculty_only,
              Profile.faculty == user_faculty,
          )
      )
    
    query = query.where(or_(*visibility_conditions))

    if club_id:
      query = query.where(Post.club_id == club_id)

    if author_id is not None:
      query = query.where(Post.author_id == author_id)

    # If faculty filtering is explicitly enabled, narrow the feed
    if faculty_only:
      if not user_faculty:
        raise BadRequestException(detail="No faculty set in your profile.")
      query = query.where(Profile.faculty == user_faculty)

    # Eager-load author profile & media
    query = query.options(
        selectinload(Post.author).selectinload(User.profile),
        selectinload(Post.media),
        selectinload(Post.poll_options),
    ).where(Post.deleted_at.is_(None))

    # 3. Apply cursor pagination (ordering by newest first)
    pagination_result = await paginate(db, query, cursor, limit, Post.created_at)
    posts = pagination_result["items"]

    # 4. Resolve is_liked, is_saved, and is_shared for the items to prevent N+1 queries
    post_ids = [p.id for p in posts]
    liked_ids = set()
    saved_ids = set()
    shared_ids = set()

    if post_ids:
      likes_result = await db.execute(
          select(Like.post_id).where(
              Like.user_id == user_id, Like.post_id.in_(post_ids)
          )
      )
      liked_ids = {r for (r,) in likes_result.all()}

      saves_result = await db.execute(
          select(Save.post_id).where(
              Save.user_id == user_id, Save.post_id.in_(post_ids)
          )
      )
      saved_ids = {r for (r,) in saves_result.all()}

      shares_result = await db.execute(
          select(Share.post_id).where(
              Share.user_id == user_id, Share.post_id.in_(post_ids)
          )
      )
      shared_ids = {r for (r,) in shares_result.all()}

    for post in posts:
      post.is_liked = post.id in liked_ids
      post.is_saved = post.id in saved_ids
      post.is_shared = post.id in shared_ids

    # Resolve poll data for poll posts
    poll_post_ids = [p.id for p in posts if p.post_type.value == "poll"]
    user_vote_map: dict[uuid.UUID, uuid.UUID] = {}
    if poll_post_ids:
      votes_result = await db.execute(
          select(PollVote.post_id, PollVote.option_id).where(
              PollVote.user_id == user_id, PollVote.post_id.in_(poll_post_ids)
          )
      )
      user_vote_map = {row[0]: row[1] for row in votes_result.all()}

    for post in posts:
      if post.post_type.value == "poll" and post.poll_options:
        total = sum(opt.vote_count for opt in post.poll_options)
        post._poll_data = {
            "options": post.poll_options,
            "total_votes": total,
            "user_vote_option_id": user_vote_map.get(post.id),
        }
      else:
        post._poll_data = None

    return pagination_result

  # ── Liking Toggles ─────────────────────────────────────────────────

  async def like_post(
      self,
      user_id: uuid.UUID,
      post_id: uuid.UUID,
      db: AsyncSession,
  ) -> None:
    """Like a post and increment counter."""
    post_check = await db.execute(select(Post).where(Post.id == post_id))
    post = post_check.scalar_one_or_none()
    if not post:
      raise NotFoundException(detail="Post not found.")

    # Check duplicate
    existing = await db.execute(
        select(Like).where(Like.user_id == user_id, Like.post_id == post_id)
    )
    if existing.scalar_one_or_none() is not None:
      return  # Already liked

    like_record = Like(user_id=user_id, post_id=post_id)
    db.add(like_record)
    
    # Atomic increment
    await db.execute(
        update(Post).where(Post.id == post_id).values(like_count=Post.like_count + 1)
    )
    await db.flush()

  async def unlike_post(
      self,
      user_id: uuid.UUID,
      post_id: uuid.UUID,
      db: AsyncSession,
  ) -> None:
    """Unlike a post and decrement counter."""
    existing = await db.execute(
        select(Like).where(Like.user_id == user_id, Like.post_id == post_id)
    )
    like_record = existing.scalar_one_or_none()
    if not like_record:
      return  # Not liked, do nothing

    await db.delete(like_record)

    # Atomic decrement
    await db.execute(
        update(Post).where(Post.id == post_id).values(like_count=Post.like_count - 1)
    )
    await db.flush()

  # ── Bookmarking Toggles ─────────────────────────────────────────────

  async def save_post(
      self,
      user_id: uuid.UUID,
      post_id: uuid.UUID,
      db: AsyncSession,
  ) -> None:
    """Save/bookmark a post."""
    post_check = await db.execute(select(Post).where(Post.id == post_id))
    if post_check.scalar_one_or_none() is None:
      raise NotFoundException(detail="Post not found.")

    existing = await db.execute(
        select(Save).where(Save.user_id == user_id, Save.post_id == post_id)
    )
    if existing.scalar_one_or_none() is not None:
      return

    save_record = Save(user_id=user_id, post_id=post_id)
    db.add(save_record)
    await db.flush()

  async def unsave_post(
      self,
      user_id: uuid.UUID,
      post_id: uuid.UUID,
      db: AsyncSession,
  ) -> None:
    """Remove a post bookmark."""
    existing = await db.execute(
        select(Save).where(Save.user_id == user_id, Save.post_id == post_id)
    )
    save_record = existing.scalar_one_or_none()
    if not save_record:
      return

    await db.delete(save_record)
    await db.flush()

  # ── Threaded Comments ────────────────────────────────────────────────

  async def create_comment(
      self,
      author_id: uuid.UUID,
      post_id: uuid.UUID,
      data: CommentCreate,
      db: AsyncSession,
  ) -> Comment:
    """Add a comment/reply and increment counter."""
    post_check = await db.execute(select(Post).where(Post.id == post_id))
    post = post_check.scalar_one_or_none()
    if not post:
      raise NotFoundException(detail="Post not found.")

    if data.parent_id:
      parent_check = await db.execute(
          select(Comment).where(
              Comment.id == data.parent_id, Comment.post_id == post_id
          )
      )
      if parent_check.scalar_one_or_none() is None:
        raise NotFoundException(detail="Parent comment not found.")

    comment = Comment(
        author_id=author_id,
        post_id=post_id,
        content=data.content,
        parent_id=data.parent_id,
    )
    db.add(comment)

    # Atomic increment
    await db.execute(
        update(Post)
        .where(Post.id == post_id)
        .values(comment_count=Post.comment_count + 1)
    )
    await db.flush()

    # Load nested relationships
    result = await db.execute(
        select(Comment)
        .options(selectinload(Comment.author).selectinload(User.profile))
        .where(Comment.id == comment.id)
    )
    return result.scalar_one()

  async def get_comments(
      self,
      post_id: uuid.UUID,
      db: AsyncSession,
  ) -> list[Comment]:
    """
    Retrieve comments for a post and wire them into a threaded hierarchy.
    """
    # Single database query to load all comments and their author info
    result = await db.execute(
        select(Comment)
        .options(selectinload(Comment.author).selectinload(User.profile))
        .where(Comment.post_id == post_id, Comment.deleted_at.is_(None))
    )
    all_comments = list(result.scalars().all())

    # Form a parent-to-children mapping list
    parent_map = {}
    top_level_comments = []

    for c in all_comments:
      if c.parent_id is None:
        top_level_comments.append(c)
      else:
        parent_map.setdefault(c.parent_id, []).append(c)

    # Wire up replies recursively
    for c in all_comments:
      replies_list = parent_map.get(c.id, [])
      c.replies = sorted(replies_list, key=lambda x: x.created_at)

    # Return top level comments sorted newest first
    return sorted(top_level_comments, key=lambda x: x.created_at, reverse=True)

  # ── Comment Deletion ─────────────────────────────────────────────────

  async def delete_comment(
      self,
      user_id: uuid.UUID,
      post_id: uuid.UUID,
      comment_id: uuid.UUID,
      db: AsyncSession,
  ) -> None:
    """Soft-delete a comment. Author only. Also decrements post comment_count."""
    result = await db.execute(
        select(Comment).where(
            Comment.id == comment_id,
            Comment.post_id == post_id,
            Comment.deleted_at.is_(None),
        )
    )
    comment = result.scalar_one_or_none()
    if not comment:
      raise NotFoundException(detail="Comment not found.")
    if comment.author_id != user_id:
      raise ForbiddenException(detail="You can only delete your own comments.")

    comment.deleted_at = datetime.now(timezone.utc)

    # Atomically decrement the denormalized counter (guard against going below 0)
    await db.execute(
        update(Post)
        .where(Post.id == post_id, Post.comment_count > 0)
        .values(comment_count=Post.comment_count - 1)
    )
    await db.flush()


  # ── Post Update ──────────────────────────────────────────────────

  async def update_post(
      self,
      user_id: uuid.UUID,
      post_id: uuid.UUID,
      data: PostUpdate,
      db: AsyncSession,
  ) -> Post:
    """Update a post's content, visibility, or tags. Owner only."""
    result = await db.execute(select(Post).where(Post.id == post_id, Post.deleted_at.is_(None)))
    post = result.scalar_one_or_none()
    if not post:
      raise NotFoundException(detail="Post not found.")
    if post.author_id != user_id:
      raise ForbiddenException(detail="You can only edit your own posts.")

    if data.content is not None:
      post.content = data.content
    if data.visibility is not None:
      post.visibility = data.visibility
    if data.tags is not None:
      post.tags = data.tags

    await db.flush()
    result = await db.execute(
        select(Post)
        .options(
            selectinload(Post.author).selectinload(User.profile),
            selectinload(Post.media),
        )
        .where(Post.id == post.id)
    )
    return result.scalar_one()

  # ── Post Delete (soft-delete) ────────────────────────────────────

  async def delete_post(
      self,
      user_id: uuid.UUID,
      post_id: uuid.UUID,
      db: AsyncSession,
  ) -> None:
    """Soft-delete a post. Owner only."""
    result = await db.execute(select(Post).where(Post.id == post_id, Post.deleted_at.is_(None)))
    post = result.scalar_one_or_none()
    if not post:
      raise NotFoundException(detail="Post not found.")
    if post.author_id != user_id:
      raise ForbiddenException(detail="You can only delete your own posts.")

    post.deleted_at = datetime.now(timezone.utc)
    await db.flush()

  # ── Share Post ───────────────────────────────────────────────────

  async def share_post(
      self,
      user_id: uuid.UUID,
      post_id: uuid.UUID,
      db: AsyncSession,
  ) -> None:
    """Share/repost a post. Idempotent — no-op if already shared."""
    result = await db.execute(select(Post).where(Post.id == post_id, Post.deleted_at.is_(None)))
    post = result.scalar_one_or_none()
    if not post:
      raise NotFoundException(detail="Post not found.")

    existing = await db.execute(
        select(Share).where(Share.user_id == user_id, Share.post_id == post_id)
    )
    if existing.scalar_one_or_none() is not None:
      return  # Already shared

    share_record = Share(user_id=user_id, post_id=post_id)
    db.add(share_record)

    await db.execute(
        update(Post).where(Post.id == post_id).values(share_count=Post.share_count + 1)
    )
    await db.flush()

  async def unshare_post(
      self,
      user_id: uuid.UUID,
      post_id: uuid.UUID,
      db: AsyncSession,
  ) -> None:
    """Remove a share/repost."""
    existing = await db.execute(
        select(Share).where(Share.user_id == user_id, Share.post_id == post_id)
    )
    share_record = existing.scalar_one_or_none()
    if not share_record:
      return

    await db.delete(share_record)

    await db.execute(
        update(Post)
        .where(Post.id == post_id, Post.share_count > 0)
        .values(share_count=Post.share_count - 1)
    )
    await db.flush()

  # ── Poll Voting ─────────────────────────────────────────────────

  async def vote_poll(
      self,
      user_id: uuid.UUID,
      post_id: uuid.UUID,
      option_id: uuid.UUID,
      db: AsyncSession,
  ) -> None:
    """Cast or change a vote on a poll post."""
    post_check = await db.execute(select(Post).where(Post.id == post_id, Post.deleted_at.is_(None)))
    post = post_check.scalar_one_or_none()
    if not post:
      raise NotFoundException(detail="Post not found.")
    if post.post_type != "poll":
      raise BadRequestException(detail="This post is not a poll.")

    # Verify option belongs to this post
    option_check = await db.execute(
        select(PollOption).where(PollOption.id == option_id, PollOption.post_id == post_id)
    )
    option = option_check.scalar_one_or_none()
    if not option:
      raise NotFoundException(detail="Poll option not found.")

    # Check if user already voted on this poll
    existing_vote = await db.execute(
        select(PollVote).where(PollVote.user_id == user_id, PollVote.post_id == post_id)
    )
    vote = existing_vote.scalar_one_or_none()

    if vote:
      if vote.option_id == option_id:
        # Toggle off: remove the vote
        option.vote_count = max(0, option.vote_count - 1)
        await db.delete(vote)
      else:
        # Change vote: decrement old option, increment new option
        old_option = await db.get(PollOption, vote.option_id)
        if old_option:
          old_option.vote_count = max(0, old_option.vote_count - 1)
        vote.option_id = option_id
        option.vote_count += 1
    else:
      # New vote
      new_vote = PollVote(user_id=user_id, post_id=post_id, option_id=option_id)
      db.add(new_vote)
      option.vote_count += 1

    await db.flush()

  # ── Report Post ──────────────────────────────────────────────────

  async def report_post(
      self,
      reporter_id: uuid.UUID,
      post_id: uuid.UUID,
      data: ReportCreate,
      db: AsyncSession,
  ) -> Report:
    """File a report against a post."""
    result = await db.execute(select(Post).where(Post.id == post_id, Post.deleted_at.is_(None)))
    post = result.scalar_one_or_none()
    if not post:
      raise NotFoundException(detail="Post not found.")

    report = Report(
        reporter_id=reporter_id,
        target_type=ReportTargetType.post,
        target_id=post_id,
        category=data.category,
        description=data.description,
    )
    db.add(report)
    await db.flush()
    return report

  # ── Saved Posts ──────────────────────────────────────────────────

  async def get_saved_posts(
      self,
      user_id: uuid.UUID,
      cursor: str | None,
      limit: int,
      db: AsyncSession,
  ) -> dict:
    """Get paginated saved/bookmarked posts for the current user."""
    subquery = (
        select(Save.post_id)
        .where(Save.user_id == user_id)
        .order_by(Save.created_at.desc())
        .subquery()
    )

    query = (
        select(Post)
        .join(subquery, Post.id == subquery.c.post_id)
        .options(
            selectinload(Post.author).selectinload(User.profile),
            selectinload(Post.media),
            selectinload(Post.poll_options),
        )
        .where(Post.deleted_at.is_(None))
        .order_by(Post.created_at.desc())
    )

    pagination_result = await paginate(db, query, cursor, limit, Post.created_at)
    posts = pagination_result["items"]

    # Mark all as saved (they came from the saves table)
    for post in posts:
      post.is_liked = False
      post.is_saved = True
      post.is_shared = False

    # Resolve liked and shared status
    post_ids = [p.id for p in posts]
    if post_ids:
      likes_result = await db.execute(
          select(Like.post_id).where(
              Like.user_id == user_id, Like.post_id.in_(post_ids)
          )
      )
      liked_ids = {r for (r,) in likes_result.all()}
      for post in posts:
        post.is_liked = post.id in liked_ids

      shares_result = await db.execute(
          select(Share.post_id).where(
              Share.user_id == user_id, Share.post_id.in_(post_ids)
          )
      )
      shared_ids = {r for (r,) in shares_result.all()}
      for post in posts:
        post.is_shared = post.id in shared_ids

    # Resolve poll data
    poll_post_ids = [p.id for p in posts if p.post_type.value == "poll"]
    user_vote_map: dict[uuid.UUID, uuid.UUID] = {}
    if poll_post_ids:
      votes_result = await db.execute(
          select(PollVote.post_id, PollVote.option_id).where(
              PollVote.user_id == user_id, PollVote.post_id.in_(poll_post_ids)
          )
      )
      user_vote_map = {row[0]: row[1] for row in votes_result.all()}
    for post in posts:
      if post.post_type.value == "poll" and post.poll_options:
        total = sum(opt.vote_count for opt in post.poll_options)
        post._poll_data = {
            "options": post.poll_options,
            "total_votes": total,
            "user_vote_option_id": user_vote_map.get(post.id),
        }
      else:
        post._poll_data = None

    return pagination_result

  async def get_liked_posts(
      self,
      user_id: uuid.UUID,
      cursor: str | None,
      limit: int,
      db: AsyncSession,
  ) -> dict:
    """Get paginated posts liked by a user."""
    subquery = (
        select(Like.post_id)
        .where(Like.user_id == user_id)
        .order_by(Like.created_at.desc())
        .subquery()
    )

    query = (
        select(Post)
        .join(subquery, Post.id == subquery.c.post_id)
        .options(
            selectinload(Post.author).selectinload(User.profile),
            selectinload(Post.media),
            selectinload(Post.poll_options),
        )
        .where(Post.deleted_at.is_(None))
        .order_by(Post.created_at.desc())
    )

    pagination_result = await paginate(db, query, cursor, limit, Post.created_at)
    posts = pagination_result["items"]

    for post in posts:
      post.is_liked = True
      post.is_saved = False
      post.is_shared = False

    post_ids = [p.id for p in posts]
    if post_ids:
      saves_result = await db.execute(
          select(Save.post_id).where(
              Save.user_id == user_id, Save.post_id.in_(post_ids)
          )
      )
      saved_ids = {r for (r,) in saves_result.all()}
      for post in posts:
        post.is_saved = post.id in saved_ids

      shares_result = await db.execute(
          select(Share.post_id).where(
              Share.user_id == user_id, Share.post_id.in_(post_ids)
          )
      )
      shared_ids = {r for (r,) in shares_result.all()}
      for post in posts:
        post.is_shared = post.id in shared_ids

    # Resolve poll data
    poll_post_ids = [p.id for p in posts if p.post_type.value == "poll"]
    user_vote_map: dict[uuid.UUID, uuid.UUID] = {}
    if poll_post_ids:
      votes_result = await db.execute(
          select(PollVote.post_id, PollVote.option_id).where(
              PollVote.user_id == user_id, PollVote.post_id.in_(poll_post_ids)
          )
      )
      user_vote_map = {row[0]: row[1] for row in votes_result.all()}
    for post in posts:
      if post.post_type.value == "poll" and post.poll_options:
        total = sum(opt.vote_count for opt in post.poll_options)
        post._poll_data = {
            "options": post.poll_options,
            "total_votes": total,
            "user_vote_option_id": user_vote_map.get(post.id),
        }
      else:
        post._poll_data = None

    return pagination_result

  async def get_user_reposts(
      self,
      user_id: uuid.UUID,
      cursor: str | None,
      limit: int,
      db: AsyncSession,
  ) -> dict:
    """Get paginated posts shared/reposted by a user."""
    subquery = (
        select(Share.post_id)
        .where(Share.user_id == user_id)
        .order_by(Share.created_at.desc())
        .subquery()
    )

    query = (
        select(Post)
        .join(subquery, Post.id == subquery.c.post_id)
        .options(
            selectinload(Post.author).selectinload(User.profile),
            selectinload(Post.media),
            selectinload(Post.poll_options),
        )
        .where(Post.deleted_at.is_(None))
        .order_by(Post.created_at.desc())
    )

    pagination_result = await paginate(db, query, cursor, limit, Post.created_at)
    posts = pagination_result["items"]

    for post in posts:
      post.is_liked = False
      post.is_saved = False
      post.is_shared = True

    post_ids = [p.id for p in posts]
    if post_ids:
      likes_result = await db.execute(
          select(Like.post_id).where(
              Like.user_id == user_id, Like.post_id.in_(post_ids)
          )
      )
      liked_ids = {r for (r,) in likes_result.all()}
      for post in posts:
        post.is_liked = post.id in liked_ids

      saves_result = await db.execute(
          select(Save.post_id).where(
              Save.user_id == user_id, Save.post_id.in_(post_ids)
          )
      )
      saved_ids = {r for (r,) in saves_result.all()}
      for post in posts:
        post.is_saved = post.id in saved_ids

    # Resolve poll data
    poll_post_ids = [p.id for p in posts if p.post_type.value == "poll"]
    user_vote_map: dict[uuid.UUID, uuid.UUID] = {}
    if poll_post_ids:
      votes_result = await db.execute(
          select(PollVote.post_id, PollVote.option_id).where(
              PollVote.user_id == user_id, PollVote.post_id.in_(poll_post_ids)
          )
      )
      user_vote_map = {row[0]: row[1] for row in votes_result.all()}
    for post in posts:
      if post.post_type.value == "poll" and post.poll_options:
        total = sum(opt.vote_count for opt in post.poll_options)
        post._poll_data = {
            "options": post.poll_options,
            "total_votes": total,
            "user_vote_option_id": user_vote_map.get(post.id),
        }
      else:
        post._poll_data = None

    return pagination_result

  async def get_user_comments(
      self,
      user_id: uuid.UUID,
      cursor: str | None,
      limit: int,
      db: AsyncSession,
  ) -> dict:
    """Get paginated comments authored by a user, with parent post context."""
    query = (
        select(Comment)
        .options(
            selectinload(Comment.author).selectinload(User.profile),
            selectinload(Comment.post).selectinload(Post.author).selectinload(User.profile),
            selectinload(Comment.post).selectinload(Post.media),
        )
        .where(
            Comment.author_id == user_id,
            Comment.deleted_at.is_(None),
        )
        .order_by(Comment.created_at.desc())
    )

    pagination_result = await paginate(db, query, cursor, limit, Comment.created_at)
    return pagination_result

  async def get_user_media_posts(
      self,
      user_id: uuid.UUID,
      cursor: str | None,
      limit: int,
      db: AsyncSession,
  ) -> dict:
    """Get paginated posts with media attachments by a user."""
    subquery = (
        select(PostMedia.post_id)
        .distinct()
        .subquery()
    )

    query = (
        select(Post)
        .join(subquery, Post.id == subquery.c.post_id)
        .options(
            selectinload(Post.author).selectinload(User.profile),
            selectinload(Post.media),
            selectinload(Post.poll_options),
        )
        .where(
            Post.author_id == user_id,
            Post.deleted_at.is_(None),
        )
        .order_by(Post.created_at.desc())
    )

    pagination_result = await paginate(db, query, cursor, limit, Post.created_at)
    posts = pagination_result["items"]

    for post in posts:
      post.is_liked = False
      post.is_saved = False
      post.is_shared = False

    post_ids = [p.id for p in posts]
    if post_ids:
      likes_result = await db.execute(
          select(Like.post_id).where(
              Like.user_id == user_id, Like.post_id.in_(post_ids)
          )
      )
      liked_ids = {r for (r,) in likes_result.all()}
      for post in posts:
        post.is_liked = post.id in liked_ids

      saves_result = await db.execute(
          select(Save.post_id).where(
              Save.user_id == user_id, Save.post_id.in_(post_ids)
          )
      )
      saved_ids = {r for (r,) in saves_result.all()}
      for post in posts:
        post.is_saved = post.id in saved_ids

      shares_result = await db.execute(
          select(Share.post_id).where(
              Share.user_id == user_id, Share.post_id.in_(post_ids)
          )
      )
      shared_ids = {r for (r,) in shares_result.all()}
      for post in posts:
        post.is_shared = post.id in shared_ids

    # Resolve poll data
    poll_post_ids = [p.id for p in posts if p.post_type.value == "poll"]
    user_vote_map: dict[uuid.UUID, uuid.UUID] = {}
    if poll_post_ids:
      votes_result = await db.execute(
          select(PollVote.post_id, PollVote.option_id).where(
              PollVote.user_id == user_id, PollVote.post_id.in_(poll_post_ids)
          )
      )
      user_vote_map = {row[0]: row[1] for row in votes_result.all()}
    for post in posts:
      if post.post_type.value == "poll" and post.poll_options:
        total = sum(opt.vote_count for opt in post.poll_options)
        post._poll_data = {
            "options": post.poll_options,
            "total_votes": total,
            "user_vote_option_id": user_vote_map.get(post.id),
        }
      else:
        post._poll_data = None

    return pagination_result


def get_post_service() -> PostService:
  """Return a PostService instance."""
  return PostService()
