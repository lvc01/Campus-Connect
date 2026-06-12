import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from app.models.club import ClubCategory, ClubMemberRole
from app.schemas.user import UserResponse


# ── Club Member Schemas ──────────────────────────────────────────────

class ClubMemberResponse(BaseModel):
  model_config = ConfigDict(from_attributes=True)

  id: uuid.UUID
  club_id: uuid.UUID
  user_id: uuid.UUID
  role: ClubMemberRole
  joined_at: datetime
  user: UserResponse


# ── Club Schemas ─────────────────────────────────────────────────────

class ClubBase(BaseModel):
  name: str = Field(min_length=2, max_length=150)
  description: str | None = Field(default=None, max_length=2000)
  category: ClubCategory | None = ClubCategory.other
  banner_url: str | None = Field(default=None, max_length=500)
  logo_url: str | None = Field(default=None, max_length=500)


class ClubCreate(ClubBase):
  pass


class ClubUpdate(BaseModel):
  description: str | None = Field(default=None, max_length=2000)
  banner_url: str | None = Field(default=None, max_length=500)
  logo_url: str | None = Field(default=None, max_length=500)


class ClubRoleUpdate(BaseModel):
  role: ClubMemberRole


class ClubResponse(ClubBase):
  model_config = ConfigDict(from_attributes=True)

  id: uuid.UUID
  slug: str
  is_verified: bool
  is_approved: bool
  is_premium: bool
  member_count: int
  created_by: uuid.UUID
  created_at: datetime
  
  # Contextual field indicating if requesting user is a member
  is_member: bool = False
  member_role: ClubMemberRole | None = None
