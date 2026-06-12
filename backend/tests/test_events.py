import uuid
from datetime import datetime, timedelta
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, hash_password
from app.models.club import Club, ClubMember, ClubMemberRole, ClubCategory
from app.models.event import Event, EventStatus, RSVP, RSVPStatus
from app.models.user import Profile, User, UserRole


async def create_custom_user(
    email: str,
    role: UserRole,
    db_session: AsyncSession,
) -> tuple[User, dict[str, str]]:
  """Helper to create a verified user with custom role and auth headers."""
  user = User(
      id=uuid.uuid4(),
      email=email,
      hashed_password=hash_password("Pass123!"),
      role=role,
      is_verified=True,
      is_active=True,
  )
  db_session.add(user)
  await db_session.flush()

  profile = Profile(
      user_id=user.id,
      display_name=email.split("@")[0].capitalize(),
  )
  db_session.add(profile)
  await db_session.commit()

  token = create_access_token(data={"sub": str(user.id)})
  headers = {"Authorization": f"Bearer {token}"}
  return user, headers


@pytest.mark.asyncio
async def test_create_independent_event(client: AsyncClient, auth_headers: dict, db_session: AsyncSession):
  """Students should be able to create independent campus events."""
  start_time = (datetime.utcnow() + timedelta(days=2)).isoformat()
  end_time = (datetime.utcnow() + timedelta(days=2, hours=3)).isoformat()

  response = await client.post(
      "/api/v1/events",
      headers=auth_headers,
      json={
          "title": "UCT Tech Talks",
          "description": "Engage with developers on campus",
          "start_time": start_time,
          "end_time": end_time,
          "location": "Menzies Hall",
          "rsvp_limit": 50,
      },
  )
  assert response.status_code == 201
  data = response.json()
  assert data["title"] == "UCT Tech Talks"
  assert data["location"] == "Menzies Hall"
  assert data["rsvp_limit"] == 50
  assert data["rsvp_count"] == 0
  assert data["status"] == "upcoming"
  assert data["club"] is None


@pytest.mark.asyncio
async def test_create_club_event_authorization(client: AsyncClient, auth_headers: dict, db_session: AsyncSession):
  """Only club owners or administrators can host events for a club."""
  # 1. Setup club and standard student user
  student_user, student_headers = await create_custom_user(
      "student@cuchd.in", UserRole.student, db_session
  )
  creator_user, creator_headers = await create_custom_user(
      "owner@cuchd.in", UserRole.student, db_session
  )

  club = Club(
      name="UCT Chess Club",
      slug="cu-chess-club",
      is_approved=True,
      created_by=creator_user.id,
      member_count=2,
      category=ClubCategory.sports,
  )
  db_session.add(club)
  await db_session.flush()

  # Associate creator as Owner, and student as standard member
  owner_member = ClubMember(
      club_id=club.id,
      user_id=creator_user.id,
      role=ClubMemberRole.owner,
  )
  stud_member = ClubMember(
      club_id=club.id,
      user_id=student_user.id,
      role=ClubMemberRole.member,
  )
  db_session.add(owner_member)
  db_session.add(stud_member)
  await db_session.commit()

  start_time = (datetime.utcnow() + timedelta(days=1)).isoformat()

  # 2. Standard club member attempts to host club event (should be rejected 403)
  member_res = await client.post(
      "/api/v1/events",
      headers=student_headers,
      json={
          "title": "Chess Blitz Tournament",
          "start_time": start_time,
          "club_id": str(club.id),
      },
  )
  assert member_res.status_code == 403

  # 3. Club owner hosts club event (should succeed 201)
  owner_res = await client.post(
      "/api/v1/events",
      headers=creator_headers,
      json={
          "title": "Chess Blitz Tournament",
          "start_time": start_time,
          "club_id": str(club.id),
      },
  )
  assert owner_res.status_code == 201
  assert owner_res.json()["title"] == "Chess Blitz Tournament"
  assert owner_res.json()["club"]["id"] == str(club.id)


@pytest.mark.asyncio
async def test_rsvp_event_limit(client: AsyncClient, auth_headers: dict, db_session: AsyncSession):
  """Students can submit RSVPs, and strict capacity limits are enforced."""
  student_a, headers_a = await create_custom_user("studenta@cuchd.in", UserRole.student, db_session)
  student_b, headers_b = await create_custom_user("studentb@cuchd.in", UserRole.student, db_session)

  # Create event with RSVP limit of 1
  start_time = (datetime.utcnow() + timedelta(days=3)).isoformat()
  event = Event(
      title="Limited Room Workshop",
      start_time=datetime.utcnow() + timedelta(days=3),
      rsvp_limit=1,
      rsvp_count=0,
      organizer_id=student_a.id,
  )
  db_session.add(event)
  await db_session.flush()
  event_id = event.id
  await db_session.commit()

  # 1. Student A RSVPs going (succeeds 200)
  rsvp_a = await client.post(
      f"/api/v1/events/{event_id}/rsvp",
      headers=headers_a,
      json={"status": "going"},
  )
  assert rsvp_a.status_code == 200
  assert rsvp_a.json()["status"] == "going"

  # Verify rsvp_count increments to 1
  db_session.expire_all()
  event_check = await db_session.execute(select(Event).where(Event.id == event_id))
  assert event_check.scalar_one().rsvp_count == 1

  # 2. Student B attempts to RSVP going (fails 400 because limit is met)
  rsvp_b = await client.post(
      f"/api/v1/events/{event_id}/rsvp",
      headers=headers_b,
      json={"status": "going"},
  )
  assert rsvp_b.status_code == 400
  assert "limit has been reached" in rsvp_b.json()["detail"]

  # 3. Student B RSVPs 'maybe' (succeeds 200 because maybe doesn't count against limit)
  rsvp_b_maybe = await client.post(
      f"/api/v1/events/{event_id}/rsvp",
      headers=headers_b,
      json={"status": "maybe"},
  )
  assert rsvp_b_maybe.status_code == 200
  assert rsvp_b_maybe.json()["status"] == "maybe"
