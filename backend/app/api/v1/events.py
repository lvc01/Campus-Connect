import uuid
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import NotFoundException
from app.models.event import EventStatus
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.event import EventCreate, EventResponse, EventUpdate, RSVPRequest, RSVPResponse
from app.services.event_service import get_event_service

router = APIRouter(prefix="/events", tags=["Events"])


@router.post(
    "",
    response_model=EventResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Host a new campus event",
)
async def create_event(
    data: EventCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> EventResponse:
  """Host a new campus event. Gated to club owner/admins if hosted under a society."""
  event_service = get_event_service()
  event = await event_service.create_event(current_user.id, data, db)
  res = EventResponse.model_validate(event)
  res.user_rsvp = None
  return res


@router.get(
    "",
    response_model=list[EventResponse],
    summary="Get campus calendar events",
)
async def get_events(
    club_id: uuid.UUID | None = Query(default=None),
    status: EventStatus | None = Query(default=None),
    search: str | None = Query(default=None),
    limit: int | None = Query(default=None, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[EventResponse]:
  """Retrieve all campus calendar events sorted chronologically."""
  event_service = get_event_service()
  events = await event_service.get_events(db, club_id, status, search)
  if limit is not None:
    events = events[:limit]
  
  rsvps_map = await event_service.get_user_rsvps(
      current_user.id, [e.id for e in events], db
  )
  
  responses = []
  for event in events:
    res = EventResponse.model_validate(event)
    res.user_rsvp = rsvps_map.get(event.id)
    responses.append(res)
    
  return responses


@router.get(
    "/{event_id}",
    response_model=EventResponse,
    summary="Get single event details",
)
async def get_event(
    event_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> EventResponse:
  """Retrieve details of a campus event by its primary key ID."""
  event_service = get_event_service()
  event = await event_service.get_event_by_id(event_id, db)
  if not event:
    raise NotFoundException(detail="Event not found.")

  res = EventResponse.model_validate(event)
  res.user_rsvp = await event_service.check_user_rsvp(current_user.id, event.id, db)
  return res


@router.patch(
    "/{event_id}",
    response_model=EventResponse,
    summary="Update campus event details",
)
async def update_event(
    event_id: uuid.UUID,
    data: EventUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> EventResponse:
  """Update event properties. Restricted to the organizer or club administrators."""
  event_service = get_event_service()
  event = await event_service.update_event(event_id, current_user.id, data, db)
  res = EventResponse.model_validate(event)
  res.user_rsvp = await event_service.check_user_rsvp(current_user.id, event.id, db)
  return res


@router.post(
    "/{event_id}/rsvp",
    response_model=RSVPResponse,
    summary="Submit or update RSVP response",
)
async def rsvp_event(
    event_id: uuid.UUID,
    data: RSVPRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RSVPResponse:
  """RSVP going, maybe, or not going to an event. Enforces RSVP limit bounds."""
  event_service = get_event_service()
  rsvp = await event_service.rsvp_event(current_user.id, event_id, data, db)
  return RSVPResponse.model_validate(rsvp)


@router.delete(
    "/{event_id}",
    response_model=MessageResponse,
    summary="Delete an event",
)
async def delete_event(
    event_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
  """Soft-delete an event. Owner or club owner/admin only."""
  event_service = get_event_service()
  await event_service.delete_event(event_id, current_user.id, db)
  return MessageResponse(message="Event deleted.")
