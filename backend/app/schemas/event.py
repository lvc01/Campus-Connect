import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from app.models.event import EventStatus, RSVPStatus
from app.schemas.user import UserResponse
from app.schemas.club import ClubResponse


class EventBase(BaseModel):
  title: str = Field(min_length=2, max_length=300)
  description: str | None = Field(default=None, max_length=5000)
  start_time: datetime
  end_time: datetime | None = None
  location: str | None = Field(default=None, max_length=300)
  cover_image_url: str | None = Field(default=None, max_length=500)
  rsvp_limit: int | None = Field(default=None, ge=1)
  club_id: uuid.UUID | None = None


class EventCreate(EventBase):
  pass


class EventUpdate(BaseModel):
  title: str | None = Field(default=None, min_length=2, max_length=300)
  description: str | None = Field(default=None, max_length=5000)
  start_time: datetime | None = None
  end_time: datetime | None = None
  location: str | None = Field(default=None, max_length=300)
  cover_image_url: str | None = Field(default=None, max_length=500)
  rsvp_limit: int | None = Field(default=None, ge=1)


class EventResponse(EventBase):
  model_config = ConfigDict(from_attributes=True)

  id: uuid.UUID
  rsvp_count: int
  status: EventStatus
  organizer_id: uuid.UUID
  created_at: datetime
  updated_at: datetime
  
  organizer: UserResponse
  club: ClubResponse | None = None
  
  # Requesting student's current RSVP state
  user_rsvp: RSVPStatus | None = None


class RSVPRequest(BaseModel):
  status: RSVPStatus = RSVPStatus.going


class RSVPResponse(BaseModel):
  model_config = ConfigDict(from_attributes=True)

  id: uuid.UUID
  event_id: uuid.UUID
  user_id: uuid.UUID
  status: RSVPStatus
  attended: bool
  created_at: datetime
