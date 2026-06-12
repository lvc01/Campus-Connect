import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, hash_password
from app.models.academic import Course, CourseMember, Resource, ResourceType
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
async def test_get_courses_seeding(client: AsyncClient, auth_headers: dict, db_session: AsyncSession):
  """Accessing the course list catalog should automatically seed defaults if empty."""
  response = await client.get("/api/v1/academics/courses", headers=auth_headers)
  assert response.status_code == 200
  data = response.json()
  
  # Check seeded defaults are returned
  assert len(data) >= 6
  course_codes = [c["code"] for c in data]
  assert "CSE101" in course_codes
  assert "ECE201" in course_codes
  assert "MEC301" in course_codes


@pytest.mark.asyncio
async def test_join_course_and_upload(client: AsyncClient, auth_headers: dict, db_session: AsyncSession):
  """Students must join a course group workspace to upload shared resources."""
  student_user, student_headers = await create_custom_user(
      "academic_stud@cuchd.in", UserRole.student, db_session
  )

  # Pre-seed CSE101 Course in DB
  course = Course(
      code="CSE101",
      name="Computer Science Engineering 101",
      faculty="Engineering",
  )
  db_session.add(course)
  await db_session.flush()
  course_id = course.id
  await db_session.commit()

  # 1. Attempt to upload past paper before joining (should be blocked 403)
  res_block = await client.post(
      f"/api/v1/academics/courses/{course_id}/resources",
      headers=student_headers,
      json={
          "title": "2025 CSE101 June Exam",
          "description": "Mock past paper notes",
          "resource_type": "past_paper",
          "file_url": "https://storage.campusconnect.co.za/notes/csc1015f-june.pdf",
          "file_size": 1542000,
      },
  )
  assert res_block.status_code == 403

  # 2. Join the course group
  join_res = await client.post(
      f"/api/v1/academics/courses/{course_id}/join",
      headers=student_headers,
  )
  assert join_res.status_code == 200
  assert "Successfully joined" in join_res.json()["message"]

  # 3. Upload past paper after joining (should succeed 201)
  res_success = await client.post(
      f"/api/v1/academics/courses/{course_id}/resources",
      headers=student_headers,
      json={
          "title": "2025 CSE101 June Exam",
          "description": "Mock past paper notes",
          "resource_type": "past_paper",
          "file_url": "https://storage.campusconnect.co.za/notes/csc1015f-june.pdf",
          "file_size": 1542000,
      },
  )
  assert res_success.status_code == 201
  data = res_success.json()
  assert data["title"] == "2025 CSE101 June Exam"
  assert data["resource_type"] == "past_paper"
  assert data["download_count"] == 0
  assert data["uploader"]["id"] == str(student_user.id)


@pytest.mark.asyncio
async def test_increment_download_count(client: AsyncClient, auth_headers: dict, db_session: AsyncSession):
  """Clicking download on an academic resource increments download counter atomically."""
  student_user, student_headers = await create_custom_user(
      "academic_stud_b@cuchd.in", UserRole.student, db_session
  )

  course = Course(code="CSE101", name="CSE 101", faculty="Engineering")
  db_session.add(course)
  await db_session.flush()
  course_id = course.id

  resource = Resource(
      course_id=course_id,
      uploaded_by=student_user.id,
      title="Lecture 1 Notes",
      resource_type=ResourceType.notes,
      file_url="https://storage.campusconnect.co.za/notes/lec1.pdf",
      download_count=10,
  )
  db_session.add(resource)
  await db_session.flush()
  resource_id = resource.id
  await db_session.commit()

  # Trigger resource download
  dl_res = await client.post(
      f"/api/v1/academics/resources/{resource_id}/download",
      headers=student_headers,
  )
  assert dl_res.status_code == 200
  assert dl_res.json()["download_count"] == 11

  # Verify in database
  db_session.expire_all()
  res_check = await db_session.execute(select(Resource).where(Resource.id == resource_id))
  assert res_check.scalar_one().download_count == 11
