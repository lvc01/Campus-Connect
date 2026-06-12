import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, hash_password
from app.models.club import Club, ClubMember, ClubMemberRole, ClubCategory
from app.models.user import Profile, User, UserRole, UserRole


# ── Utility User Creators ─────────────────────────────────────────────

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


# ── Club Tests ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_club_unapproved(client: AsyncClient, auth_headers: dict, db_session: AsyncSession):
  """Creating a club should initialize as unapproved with creator as Owner."""
  response = await client.post(
      "/api/v1/clubs",
      headers=auth_headers,
      json={
          "name": "CU Developer Society",
          "description": "Building the future #tech",
          "category": "tech",
      },
  )
  assert response.status_code == 201
  data = response.json()
  assert data["name"] == "CU Developer Society"
  assert data["slug"] == "cu-developer-society"
  assert data["is_approved"] is False
  assert data["is_verified"] is False
  assert data["member_count"] == 1
  assert data["is_member"] is True
  assert data["member_role"] == "owner"

  # Verify DB records
  club_id = uuid.UUID(data["id"])
  club_check = await db_session.execute(select(Club).where(Club.id == club_id))
  club = club_check.scalar_one()
  assert club.is_approved is False

  member_check = await db_session.execute(
      select(ClubMember).where(ClubMember.club_id == club_id)
  )
  members = list(member_check.scalars().all())
  assert len(members) == 1
  assert members[0].role == ClubMemberRole.owner


@pytest.mark.asyncio
async def test_get_clubs_approved_only(
    client: AsyncClient,
    auth_headers: dict,
    db_session: AsyncSession,
):
  """Directory should only return approved clubs."""
  # 1. Create a requested (unapproved) club
  await client.post(
      "/api/v1/clubs",
      headers=auth_headers,
      json={"name": "Pending Club", "category": "sports"},
  )

  # 2. Add an already approved club in DB directly
  approved_club = Club(
      name="Approved Sports Club",
      slug="approved-sports-club",
      category=ClubCategory.sports,
      is_approved=True,
      created_by=uuid.uuid4(),
      member_count=10,
  )
  db_session.add(approved_club)
  await db_session.commit()

  # 3. Retrieve directory feed
  response = await client.get("/api/v1/clubs", headers=auth_headers)
  assert response.status_code == 200
  items = response.json()
  
  # Should only display the approved club
  assert len(items) == 1
  assert items[0]["slug"] == "approved-sports-club"
  assert items[0]["is_approved"] is True


@pytest.mark.asyncio
async def test_join_leave_club(
    client: AsyncClient,
    auth_headers: dict,
    db_session: AsyncSession,
):
  """Students should join and leave clubs, updating counters atomically."""
  # 1. Setup approved club
  student_user, student_headers = await create_custom_user(
      "student@cuchd.in", UserRole.student, db_session
  )
  club = Club(
      name="Rowing Society",
      slug="rowing-society",
      category=ClubCategory.sports,
      is_approved=True,
      created_by=uuid.uuid4(),
      member_count=1,
  )
  db_session.add(club)
  await db_session.commit()

  club_id = club.id
  club_slug = club.slug

  # 2. Join rowing club
  join_res = await client.post(
      f"/api/v1/clubs/{club_id}/join",
      headers=student_headers,
  )
  assert join_res.status_code == 200

  # Check member count incremented to 2
  db_session.expire_all()
  club_check = await db_session.execute(select(Club).where(Club.id == club_id))
  assert club_check.scalar_one().member_count == 2

  # Check single details shows is_member = True
  detail_res = await client.get(
      f"/api/v1/clubs/{club_slug}",
      headers=student_headers,
  )
  assert detail_res.json()["is_member"] is True

  # 3. Leave rowing club
  leave_res = await client.delete(
      f"/api/v1/clubs/{club_id}/join",
      headers=student_headers,
  )
  assert leave_res.status_code == 200

  # Check member count decremented to 1
  db_session.expire_all()
  club_check2 = await db_session.execute(select(Club).where(Club.id == club_id))
  assert club_check2.scalar_one().member_count == 1


@pytest.mark.asyncio
async def test_owner_cannot_leave(
    client: AsyncClient,
    auth_headers: dict,
    db_session: AsyncSession,
):
  """Society owners are restricted from leaving their own society."""
  # Creator makes a club
  response = await client.post(
      "/api/v1/clubs",
      headers=auth_headers,
      json={"name": "Gaming Club", "category": "social"},
  )
  club_id = response.json()["id"]

  # Moderator approves the club first (must be approved to join/leave)
  club_db = await db_session.execute(
      select(Club).where(Club.id == uuid.UUID(club_id))
  )
  club_db.scalar_one().is_approved = True
  await db_session.commit()

  # Try to leave
  leave_res = await client.delete(
      f"/api/v1/clubs/{club_id}/join",
      headers=auth_headers,
  )
  assert leave_res.status_code == 400
  assert "owners cannot leave" in leave_res.json()["detail"]


@pytest.mark.asyncio
async def test_moderator_approval_gate(
    client: AsyncClient,
    auth_headers: dict,
    db_session: AsyncSession,
):
  """Only platform moderators can approve or verify societies."""
  # 1. Setup pending club and moderator user
  mod_user, mod_headers = await create_custom_user(
      "mod@campusconnect.co.za", UserRole.moderator, db_session
  )
  
  create_res = await client.post(
      "/api/v1/clubs",
      headers=auth_headers,
      json={"name": "Investment Club", "category": "academic"},
  )
  club_id = create_res.json()["id"]

  # 2. Standard student attempts approval (should be rejected 403)
  student_approve = await client.patch(
      f"/api/v1/clubs/{club_id}/approve",
      headers=auth_headers,
  )
  assert student_approve.status_code == 403

  # 3. Moderator approves club (should succeed 200)
  mod_approve = await client.patch(
      f"/api/v1/clubs/{club_id}/approve",
      headers=mod_headers,
  )
  assert mod_approve.status_code == 200
  assert mod_approve.json()["is_approved"] is True

  # 4. Moderator verifies club (should succeed 200)
  mod_verify = await client.patch(
      f"/api/v1/clubs/{club_id}/verify",
      headers=mod_headers,
  )
  assert mod_verify.status_code == 200
  assert mod_verify.json()["is_verified"] is True
