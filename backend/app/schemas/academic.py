import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from app.models.academic import CourseMemberRole, ResourceType
from app.schemas.user import UserResponse


class CourseBase(BaseModel):
  code: str = Field(min_length=2, max_length=20)
  name: str = Field(min_length=2, max_length=200)
  faculty: str = Field(min_length=2, max_length=100)
  description: str | None = Field(default=None, max_length=2000)
  year: int | None = Field(default=None, ge=1, le=6)
  semester: int | None = Field(default=None, ge=1, le=2)


class CourseCreate(CourseBase):
  pass


class CourseResponse(CourseBase):
  model_config = ConfigDict(from_attributes=True)

  id: uuid.UUID
  created_at: datetime
  
  # Computed metrics
  member_count: int = 0
  resource_count: int = 0
  is_member: bool = False
  member_role: CourseMemberRole | None = None


class ResourceBase(BaseModel):
  title: str = Field(min_length=2, max_length=300)
  description: str | None = Field(default=None, max_length=2000)
  resource_type: ResourceType = ResourceType.other
  file_url: str = Field(max_length=500)
  file_size: int | None = Field(default=None, ge=0)


class ResourceCreate(ResourceBase):
  pass


class ResourceResponse(ResourceBase):
  model_config = ConfigDict(from_attributes=True)

  id: uuid.UUID
  course_id: uuid.UUID
  uploaded_by: uuid.UUID
  download_count: int
  created_at: datetime
  
  uploader: UserResponse


# ── Study Group Schemas ─────────────────────────────────────────────

class StudyGroupCreate(BaseModel):
  name: str = Field(min_length=2, max_length=200)
  description: str | None = Field(default=None, max_length=2000)
  max_members: int = Field(default=10, ge=2, le=50)


class StudyGroupResponse(BaseModel):
  model_config = ConfigDict(from_attributes=True)

  id: uuid.UUID
  course_id: uuid.UUID
  name: str
  description: str | None
  max_members: int
  created_by: uuid.UUID
  created_at: datetime

  member_count: int = 0
  is_member: bool = False
