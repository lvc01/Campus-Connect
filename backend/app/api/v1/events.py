import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import NotFoundException
from app.core.rate_limiter import rate_limit
from app.models.event import EventSave, EventStatus, RSVP, RSVPStatus
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
    dependencies=[Depends(rate_limit(max_requests=10, window_seconds=3600))],
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
    saved_only: bool = Query(default=False),
    my_events: bool = Query(default=False),
    past: bool = Query(default=False),
    upcoming: bool = Query(default=False),
    limit: int | None = Query(default=50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[EventResponse]:
  """Retrieve all campus calendar events sorted chronologically."""
  event_service = get_event_service()
  now = datetime.now(timezone.utc)

  if past:
    events = await event_service.get_past_events(db, now, club_id, status, search)
  elif upcoming:
    events = await event_service.get_upcoming_events(db, now, club_id, status, search)
  else:
    events = await event_service.get_events(db, club_id, status, search)

  if my_events:
    events = [e for e in events if e.organizer_id == current_user.id]

  if saved_only:
    saved_result = await db.execute(
        select(EventSave.event_id).where(EventSave.user_id == current_user.id)
    )
    saved_ids = set(saved_result.scalars().all())
    events = [e for e in events if e.id in saved_ids]

  if limit is not None:
    events = events[:limit]
  
  rsvps_map = await event_service.get_user_rsvps(
      current_user.id, [e.id for e in events], db
  )
  
  # Get saved events
  saved_result = await db.execute(
      select(EventSave.event_id).where(EventSave.user_id == current_user.id)
  )
  saved_ids = set(saved_result.scalars().all())
  
  responses = []
  for event in events:
    res = EventResponse.model_validate(event)
    res.user_rsvp = rsvps_map.get(event.id)
    res.is_saved = event.id in saved_ids
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

  saved_result = await db.execute(
      select(EventSave.event_id).where(
          EventSave.event_id == event.id, EventSave.user_id == current_user.id
      )
  )
  res.is_saved = saved_result.scalar_one_or_none() is not None

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


@router.get(
    "/{event_id}/attendees",
    summary="Get event attendees by RSVP status",
)
async def get_event_attendees(
    event_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
  """Get lists of users who RSVP'd going, maybe, or not_going."""
  # Verify event exists
  event_check = await db.execute(
      select(Event).where(Event.id == event_id, Event.deleted_at.is_(None))
  )
  event = event_check.scalar_one_or_none()
  if not event:
    raise NotFoundException(detail="Event not found.")

  result = await db.execute(
      select(RSVP)
      .options(selectinload(RSVP.user).selectinload(User.profile))
      .where(RSVP.event_id == event_id)
  )
  rsvps = result.scalars().all()

  going = []
  maybe = []
  not_going = []
  for r in rsvps:
    user_data = {
        "id": str(r.user.id),
        "email": r.user.email,
        "display_name": r.user.profile.display_name if r.user.profile else r.user.email,
        "avatar_url": r.user.profile.avatar_url if r.user.profile else None,
    }
    if r.status == RSVPStatus.going:
      going.append(user_data)
    elif r.status == RSVPStatus.maybe:
      maybe.append(user_data)
    elif r.status == RSVPStatus.not_going:
      not_going.append(user_data)

  return {"going": going, "maybe": maybe, "not_going": not_going}


@router.post(
    "/{event_id}/save",
    response_model=MessageResponse,
    summary="Save/bookmark an event",
)
async def save_event(
    event_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
  """Save an event to your bookmarks."""
  existing = await db.execute(
      select(EventSave).where(EventSave.event_id == event_id, EventSave.user_id == current_user.id)
  )
  if existing.scalar_one_or_none():
    return MessageResponse(message="Event already saved.")

  db.add(EventSave(event_id=event_id, user_id=current_user.id))
  await db.flush()
  return MessageResponse(message="Event saved.")


@router.delete(
    "/{event_id}/save",
    response_model=MessageResponse,
    summary="Unsave/unbookmark an event",
)
async def unsave_event(
    event_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
  """Remove an event from your bookmarks."""
  result = await db.execute(
      delete(EventSave).where(EventSave.event_id == event_id, EventSave.user_id == current_user.id)
  )
  await db.flush()
  return MessageResponse(message="Event unsaved.")
