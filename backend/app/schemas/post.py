import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, model_validator
from app.models.post import MediaType, PostType, PostVisibility
from app.schemas.user import UserResponse


# ── Poll Schemas ───────────────────────────────────────────────────

class PollOptionCreate(BaseModel):
    text: str = Field(min_length=1, max_length=200)
    position: int = Field(ge=0)


class PollOptionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    text: str
    position: int
    vote_count: int


class PollData(BaseModel):
    options: list[PollOptionResponse]
    total_votes: int
    user_vote_option_id: uuid.UUID | None = None


# ── Post Media Schemas ───────────────────────────────────────────────

class PostMediaBase(BaseModel):
  media_type: MediaType
  url: str = Field(max_length=500)
  thumbnail_url: str | None = Field(default=None, max_length=500)
  order: int = Field(default=0, ge=0)


class PostMediaCreate(PostMediaBase):
  pass


class PostMediaResponse(PostMediaBase):
  model_config = ConfigDict(from_attributes=True)

  id: uuid.UUID
  post_id: uuid.UUID
  created_at: datetime


# ── Comment Schemas ──────────────────────────────────────────────────

class CommentBase(BaseModel):
  content: str = Field(min_length=1, max_length=2000)
  parent_id: uuid.UUID | None = None


class CommentCreate(CommentBase):
  pass


class CommentResponse(CommentBase):
  model_config = ConfigDict(from_attributes=True)

  id: uuid.UUID
  post_id: uuid.UUID
  author_id: uuid.UUID
  author: UserResponse
  like_count: int
  created_at: datetime
  replies: list["CommentResponse"] = Field(default_factory=list)


# ── Post Schemas ─────────────────────────────────────────────────────

class PostBase(BaseModel):
  content: str | None = Field(default=None, max_length=5000)
  post_type: PostType = PostType.text
  visibility: PostVisibility = PostVisibility.public
  tags: list[str] | None = Field(default=None)
  club_id: uuid.UUID | None = None


class PostCreate(PostBase):
  media_urls: list[str] | None = Field(default=None)
  poll_options: list[PollOptionCreate] | None = Field(default=None)


class PostUpdate(BaseModel):
  """Partial update for a post. Only provided fields are changed."""
  content: str | None = Field(default=None, max_length=5000)
  visibility: PostVisibility | None = None
  tags: list[str] | None = None


class PostResponse(PostBase):
  model_config = ConfigDict(from_attributes=True)

  id: uuid.UUID
  author_id: uuid.UUID
  author: UserResponse
  like_count: int
  comment_count: int
  share_count: int
  is_pinned: bool = False
  is_promoted: bool = False
  created_at: datetime
  updated_at: datetime
  media: list[PostMediaResponse] = Field(default_factory=list)
  
  # Contextual fields computed at query time relative to requesting user
  is_liked: bool = False
  is_saved: bool = False
  is_shared: bool = False

  # Poll data (only populated for poll posts)
  poll: PollData | None = None

  @model_validator(mode="before")
  @classmethod
  def extract_poll_data(cls, values):
    """Extract poll data from the _poll_data attribute set by the service layer."""
    if hasattr(values, "_poll_data"):
      poll_data = values._poll_data
      if poll_data is not None:
        from app.models.post import PollOption as PollOptionModel
        options = []
        for opt in poll_data["options"]:
          if isinstance(opt, PollOptionModel):
            options.append(PollOptionResponse(
                id=opt.id, text=opt.text, position=opt.position, vote_count=opt.vote_count
            ))
          else:
            options.append(opt)
        values.poll = PollData(
            options=options,
            total_votes=poll_data["total_votes"],
            user_vote_option_id=poll_data.get("user_vote_option_id"),
        )
      else:
        values.poll = None
    return values


# ── Feed & Pagination Schemas ────────────────────────────────────────

class FeedResponse(BaseModel):
  items: list[PostResponse]
  next_cursor: str | None = None
  has_more: bool


class CommentWithPostResponse(CommentResponse):
  """Comment response that includes the parent post context."""
  post: PostResponse | None = None


class CommentListResponse(BaseModel):
  items: list[CommentWithPostResponse]
  next_cursor: str | None = None
  has_more: bool


class VoteRequest(BaseModel):
  option_id: uuid.UUID
