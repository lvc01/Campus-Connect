import uuid
from datetime import datetime, timezone
from sqlalchemy import and_, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import BadRequestException, ForbiddenException, NotFoundException
from app.models.event import Event, EventStatus, RSVP, RSVPStatus
from app.models.club import Club, ClubMember, ClubMemberRole
from app.models.user import User
from app.schemas.event import EventCreate, EventUpdate, RSVPRequest


class EventService:
  """Handles all campus event lifecycles, RSVPs, limits, and calendar streams."""

  # ── Event Creation ──────────────────────────────────────────────────

  async def create_event(
      self,
      organizer_id: uuid.UUID,
      data: EventCreate,
      db: AsyncSession,
  ) -> Event:
    """
    Host a new event. If club_id is set, gates permission to club owner/admins.
    """
    # 1. Enforce gates for club-hosted events
    if data.club_id:
      club_check = await db.execute(
          select(Club).where(Club.id == data.club_id, Club.deleted_at.is_(None))
      )
      club = club_check.scalar_one_or_none()
      if not club:
        raise NotFoundException(detail="Hosting society not found.")
      
      if not club.is_approved:
        raise BadRequestException(detail="Cannot host events for an unapproved society.")

      member_check = await db.execute(
          select(ClubMember).where(
              ClubMember.club_id == data.club_id, ClubMember.user_id == organizer_id
          )
      )
      member = member_check.scalar_one_or_none()
      if not member or member.role not in [ClubMemberRole.owner, ClubMemberRole.admin]:
        raise ForbiddenException(
            detail="You do not have permission to host events for this society."
        )

    # 2. Build the event record
    event = Event(
        title=data.title.strip(),
        description=data.description.strip() if data.description else None,
        start_time=data.start_time,
        end_time=data.end_time,
        location=data.location.strip() if data.location else None,
        cover_image_url=data.cover_image_url.strip() if data.cover_image_url else None,
        rsvp_limit=data.rsvp_limit,
        club_id=data.club_id,
        organizer_id=organizer_id,
        rsvp_count=0,
        status=EventStatus.upcoming,
    )
    db.add(event)
    await db.flush()

    # Eager load relationships
    result = await db.execute(
        select(Event)
        .options(
            selectinload(Event.organizer).selectinload(User.profile),
            selectinload(Event.club),
        )
        .where(Event.id == event.id)
    )
    return result.scalar_one()

  # ── Calendar Discovery & Streams ──────────────────────────────────

  async def get_events(
      self,
      db: AsyncSession,
      club_id: uuid.UUID | None = None,
      status: EventStatus | None = None,
      search: str | None = None,
  ) -> list[Event]:
    """
    Retrieve campus calendar events ordered by start time.
    """
    query = select(Event).options(
        selectinload(Event.organizer).selectinload(User.profile),
        selectinload(Event.club),
    ).where(Event.deleted_at.is_(None))

    if club_id:
      query = query.where(Event.club_id == club_id)

    if status:
      query = query.where(Event.status == status)

    if search:
      search_term = f"%{search.strip()}%"
      query = query.where(
          or_(
              Event.title.ilike(search_term),
              Event.description.ilike(search_term),
              Event.location.ilike(search_term),
          )
      )

    # Order chronologically
    query = query.order_by(Event.start_time.asc())

    result = await db.execute(query)
    return list(result.scalars().all())

  async def get_event_by_id(
      self,
      event_id: uuid.UUID,
      db: AsyncSession,
  ) -> Event | None:
    """Fetch single event profile details by primary key."""
    result = await db.execute(
        select(Event)
        .options(
            selectinload(Event.organizer).selectinload(User.profile),
            selectinload(Event.club),
        )
        .where(Event.id == event_id, Event.deleted_at.is_(None))
    )
    return result.scalar_one_or_none()

  # ── Event RSVP Management ─────────────────────────────────────────

  async def rsvp_event(
      self,
      user_id: uuid.UUID,
      event_id: uuid.UUID,
      data: RSVPRequest,
      db: AsyncSession,
  ) -> RSVP:
    """
    Submit or update RSVP response. Enforces capacity limits for 'going'.
    """
    event_check = await db.execute(
        select(Event).where(Event.id == event_id, Event.deleted_at.is_(None))
    )
    event = event_check.scalar_one_or_none()
    if not event:
      raise NotFoundException(detail="Event not found.")

    # 1. Check existing RSVP
    rsvp_check = await db.execute(
        select(RSVP).where(RSVP.event_id == event_id, RSVP.user_id == user_id)
    )
    rsvp = rsvp_check.scalar_one_or_none()

    old_status = rsvp.status if rsvp else None
    new_status = data.status

    # 2. Re-calculate counts and enforce limit bounds
    if old_status == new_status:
      return rsvp  # No change

    # Check capacity limit only if joining as going
    if new_status == RSVPStatus.going and old_status != RSVPStatus.going:
      if event.rsvp_limit is not None and event.rsvp_count >= event.rsvp_limit:
        raise BadRequestException(detail="Event RSVP limit has been reached.")

    # 3. Apply atomic increment/decrement transitions on the Event model
    delta = 0
    if old_status == RSVPStatus.going and new_status != RSVPStatus.going:
      delta = -1
    elif old_status != RSVPStatus.going and new_status == RSVPStatus.going:
      delta = 1

    if delta != 0:
      await db.execute(
          update(Event)
          .where(Event.id == event_id)
          .values(rsvp_count=Event.rsvp_count + delta)
      )

    # 4. Upsert/Update the RSVP record
    if rsvp:
      rsvp.status = new_status
    else:
      rsvp = RSVP(
          event_id=event_id,
          user_id=user_id,
          status=new_status,
      )
      db.add(rsvp)

    await db.flush()
    return rsvp

  async def check_user_rsvp(
      self,
      user_id: uuid.UUID,
      event_id: uuid.UUID,
      db: AsyncSession,
  ) -> RSVPStatus | None:
    """Return active student's RSVP selection."""
    result = await db.execute(
        select(RSVP.status).where(RSVP.event_id == event_id, RSVP.user_id == user_id)
    )
    return result.scalar_one_or_none()

  async def get_user_rsvps(
      self,
      user_id: uuid.UUID,
      event_ids: list[uuid.UUID],
      db: AsyncSession,
  ) -> dict[uuid.UUID, RSVPStatus]:
    """Return a mapping of event_id -> RSVPStatus for the given user in bulk."""
    if not event_ids:
      return {}
    result = await db.execute(
        select(RSVP.event_id, RSVP.status).where(
            RSVP.user_id == user_id,
            RSVP.event_id.in_(event_ids),
        )
    )
    return {event_id: status for event_id, status in result.all()}

  # ── Management Permissions ────────────────────────────────────────

  # ── Event Deletion (soft-delete) ───────────────────────────────

  async def delete_event(
      self,
      event_id: uuid.UUID,
      user_id: uuid.UUID,
      db: AsyncSession,
  ) -> None:
    """Soft-delete an event. Owner or club owner/admin only."""
    event = await self.get_event_by_id(event_id, db)
    if not event:
      raise NotFoundException(detail="Event not found.")

    is_authorized = event.organizer_id == user_id
    if not is_authorized and event.club_id:
      member_check = await db.execute(
          select(ClubMember).where(
              ClubMember.club_id == event.club_id, ClubMember.user_id == user_id
          )
      )
      member = member_check.scalar_one_or_none()
      if member and member.role in [ClubMemberRole.owner, ClubMemberRole.admin]:
        is_authorized = True

    if not is_authorized:
      raise ForbiddenException(detail="You do not have permission to delete this event.")

    event.deleted_at = datetime.now(timezone.utc)
    await db.flush()

  async def update_event(
      self,
      event_id: uuid.UUID,
      user_id: uuid.UUID,
      data: EventUpdate,
      db: AsyncSession,
  ) -> Event:
    """Update event profile details. Restricted to organizer or club owner/admins."""
    event = await self.get_event_by_id(event_id, db)
    if not event:
      raise NotFoundException(detail="Event not found.")

    # Authorization check
    is_authorized = event.organizer_id == user_id

    if not is_authorized and event.club_id:
      member_check = await db.execute(
          select(ClubMember).where(
              ClubMember.club_id == event.club_id, ClubMember.user_id == user_id
          )
      )
      member = member_check.scalar_one_or_none()
      if member and member.role in [ClubMemberRole.owner, ClubMemberRole.admin]:
        is_authorized = True

    if not is_authorized:
      raise ForbiddenException(detail="You do not have permission to manage this event.")

    # Apply updates
    if data.title is not None:
      event.title = data.title.strip()
    if data.description is not None:
      event.description = data.description.strip() if data.description else None
    if data.start_time is not None:
      event.start_time = data.start_time
    if data.end_time is not None:
      event.end_time = data.end_time
    if data.location is not None:
      event.location = data.location.strip() if data.location else None
    if data.cover_image_url is not None:
      event.cover_image_url = data.cover_image_url.strip() if data.cover_image_url else None

    # Handle RSVP limit changes
    if data.rsvp_limit is not None:
      # If decreasing, ensure it doesn't break boundaries or just set it
      event.rsvp_limit = data.rsvp_limit

    await db.flush()
    return event


def get_event_service() -> EventService:
  """Return an EventService instance."""
  return EventService()
