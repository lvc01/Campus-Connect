import uuid
from datetime import datetime, timezone
from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import BadRequestException, ConflictException, ForbiddenException, NotFoundException
from app.models.academic import Course, CourseMember, CourseMemberRole, Resource, ResourceType, StudyGroup, StudyGroupMember
from app.models.user import User
from app.schemas.academic import CourseCreate, ResourceCreate, StudyGroupCreate


class AcademicService:
  """Handles all campus academic workspaces, course catalogs, past papers, and downloads."""

  # ── Course Discoveries & Seeding ──────────────────────────────────

  async def seed_courses_if_empty(self, db: AsyncSession) -> None:
    """Pre-populates sample major university modules to avoid empty lists."""
    count_check = await db.execute(select(func.count(Course.id)))
    if count_check.scalar() > 0:
      return  # Already seeded

    default_courses = [
        # Engineering Faculty
        Course(
            code="CSE101",
            name="Computer Science Engineering 101",
            faculty="Engineering",
            description="Introduction to programming, data structures, algorithms, and computational thinking using C/C++.",
            year=1,
            semester=1,
        ),
        Course(
            code="ECE201",
            name="Digital Electronics & Logic Design",
            faculty="Engineering",
            description="Boolean algebra, combinational and sequential circuits, flip-flops, and basic microprocessor architecture.",
            year=2,
            semester=1,
        ),
        Course(
            code="MEC301",
            name="Fluid Mechanics & Hydraulics",
            faculty="Engineering",
            description="Fluid statics and dynamics, flow measurement, pipe networks, and turbine/pump analysis.",
            year=3,
            semester=1,
        ),
        # Computer Applications Faculty
        Course(
            code="BCA101",
            name="Fundamentals of IT & Programming",
            faculty="Computer Applications",
            description="Basics of information technology, programming logic, web fundamentals, and database concepts.",
            year=1,
            semester=1,
        ),
        Course(
            code="MCA201",
            name="Advanced Java & Web Technologies",
            faculty="Computer Applications",
            description="Object-oriented programming with Java, servlets, JSP, and modern full-stack web development.",
            year=2,
            semester=1,
        ),
        # Management Faculty
        Course(
            code="BBA101",
            name="Principles of Management",
            faculty="Management",
            description="Fundamentals of management theory, organizational behavior, leadership, and strategic planning.",
            year=1,
            semester=1,
        ),
        Course(
            code="MBA201",
            name="Marketing Management & Analytics",
            faculty="Management",
            description="Market research, consumer behavior, brand strategy, digital marketing, and data-driven decision making.",
            year=2,
            semester=1,
        ),
    ]
    db.add_all(default_courses)
    await db.flush()

  async def get_courses(
      self,
      user_id: uuid.UUID,
      db: AsyncSession,
      faculty: str | None = None,
      search: str | None = None,
  ) -> list[Course]:
    """
    Retrieve academic courses catalog. Computes real-time student memberships and document counts.
    """
    # Ensure standard courses are seeded
    await self.seed_courses_if_empty(db)

    # Basic query
    query = select(Course)

    if faculty:
      query = query.where(Course.faculty.ilike(faculty.strip()))

    if search:
      search_term = f"%{search.strip()}%"
      query = query.where(
          or_(
              Course.code.ilike(search_term),
              Course.name.ilike(search_term),
          )
      )

    # Order alphabetically by course code
    query = query.order_by(Course.code.asc())

    result = await db.execute(query)
    courses = list(result.scalars().all())

    # Resolve counters and current user's membership for each Course in the batch
    for course in courses:
      # 1. Member Count
      m_count = await db.execute(
          select(func.count(CourseMember.id)).where(CourseMember.course_id == course.id)
      )
      course.member_count = m_count.scalar() or 0

      # 2. Resource Count
      r_count = await db.execute(
          select(func.count(Resource.id)).where(
              Resource.course_id == course.id, Resource.deleted_at.is_(None)
          )
      )
      course.resource_count = r_count.scalar() or 0

      # 3. User Membership details
      member_check = await db.execute(
          select(CourseMember).where(
              CourseMember.course_id == course.id, CourseMember.user_id == user_id
          )
      )
      member = member_check.scalar_one_or_none()
      course.is_member = member is not None
      course.member_role = member.role if member else None

    return courses

  async def get_course_by_id(
      self,
      course_id: uuid.UUID,
      user_id: uuid.UUID,
      db: AsyncSession,
  ) -> Course | None:
    """Fetch details of a single course, including computed membership contexts."""
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    if not course:
      return None

    # Compute counters
    m_count = await db.execute(
        select(func.count(CourseMember.id)).where(CourseMember.course_id == course.id)
    )
    course.member_count = m_count.scalar() or 0

    r_count = await db.execute(
        select(func.count(Resource.id)).where(
            Resource.course_id == course.id, Resource.deleted_at.is_(None)
        )
    )
    course.resource_count = r_count.scalar() or 0

    member_check = await db.execute(
        select(CourseMember).where(
            CourseMember.course_id == course.id, CourseMember.user_id == user_id
        )
    )
    member = member_check.scalar_one_or_none()
    course.is_member = member is not None
    course.member_role = member.role if member else None

    return course

  # ── Course Memberships ────────────────────────────────────────────

  async def join_course(
      self,
      user_id: uuid.UUID,
      course_id: uuid.UUID,
      db: AsyncSession,
  ) -> CourseMember:
    """Join a course group workspace as a student."""
    course_check = await db.execute(select(Course).where(Course.id == course_id))
    if course_check.scalar_one_or_none() is None:
      raise NotFoundException(detail="Course workspace not found.")

    # Check already registered
    existing = await db.execute(
        select(CourseMember).where(
            CourseMember.course_id == course_id, CourseMember.user_id == user_id
        )
    )
    member = existing.scalar_one_or_none()
    if member:
      return member  # Already joined

    member = CourseMember(
        course_id=course_id,
        user_id=user_id,
        role=CourseMemberRole.student,
    )
    db.add(member)
    await db.flush()
    return member

  # ── Resource Sharing Hubs ─────────────────────────────────────────

  async def get_course_resources(
      self,
      course_id: uuid.UUID,
      db: AsyncSession,
      resource_type: ResourceType | None = None,
  ) -> list[Resource]:
    """Retrieve shared past papers, notes, or study guides inside a course workspace."""
    query = select(Resource).options(
        selectinload(Resource.uploader).selectinload(User.profile)
    ).where(Resource.course_id == course_id, Resource.deleted_at.is_(None))

    if resource_type:
      query = query.where(Resource.resource_type == resource_type)

    query = query.order_by(Resource.created_at.desc())
    
    result = await db.execute(query)
    return list(result.scalars().all())

  async def upload_resource(
      self,
      uploader_id: uuid.UUID,
      course_id: uuid.UUID,
      data: ResourceCreate,
      db: AsyncSession,
  ) -> Resource:
    """Upload study notes or past papers to a course workspace."""
    course_check = await db.execute(select(Course).where(Course.id == course_id))
    if course_check.scalar_one_or_none() is None:
      raise NotFoundException(detail="Target course workspace not found.")

    # Enforce course membership to upload documents
    member_check = await db.execute(
        select(CourseMember).where(
            CourseMember.course_id == course_id, CourseMember.user_id == uploader_id
        )
    )
    if member_check.scalar_one_or_none() is None:
      raise ForbiddenException(detail="You must join the course before uploading study guides.")

    resource = Resource(
        course_id=course_id,
        uploaded_by=uploader_id,
        title=data.title.strip(),
        description=data.description.strip() if data.description else None,
        resource_type=data.resource_type,
        file_url=data.file_url.strip(),
        file_size=data.file_size,
        download_count=0,
    )
    db.add(resource)
    await db.flush()

    # Load uploader profile
    result = await db.execute(
        select(Resource)
        .options(selectinload(Resource.uploader).selectinload(User.profile))
        .where(Resource.id == resource.id)
    )
    return result.scalar_one()

  async def increment_download(
      self,
      resource_id: uuid.UUID,
      db: AsyncSession,
  ) -> Resource:
    """Atomically increment a shared document's download counter."""
    resource_check = await db.execute(
        select(Resource).where(Resource.id == resource_id, Resource.deleted_at.is_(None))
    )
    resource = resource_check.scalar_one_or_none()
    if not resource:
      raise NotFoundException(detail="Resource file not found.")

    await db.execute(
        update(Resource)
        .where(Resource.id == resource_id)
        .values(download_count=Resource.download_count + 1)
    )
    await db.flush()
    await db.refresh(resource)
    return resource


  # ── Course Leave ──────────────────────────────────────────────────

  async def leave_course(
      self,
      user_id: uuid.UUID,
      course_id: uuid.UUID,
      db: AsyncSession,
  ) -> None:
    """Leave a course workspace."""
    member_check = await db.execute(
        select(CourseMember).where(
            CourseMember.course_id == course_id, CourseMember.user_id == user_id
        )
    )
    member = member_check.scalar_one_or_none()
    if not member:
      raise NotFoundException(detail="You are not a member of this course.")

    await db.delete(member)
    await db.flush()

  # ── Resource Delete ───────────────────────────────────────────────

  async def delete_resource(
      self,
      resource_id: uuid.UUID,
      user_id: uuid.UUID,
      db: AsyncSession,
  ) -> None:
    """Soft-delete a resource. Uploader only."""
    result = await db.execute(
        select(Resource).where(Resource.id == resource_id, Resource.deleted_at.is_(None))
    )
    resource = result.scalar_one_or_none()
    if not resource:
      raise NotFoundException(detail="Resource not found.")
    if resource.uploaded_by != user_id:
      raise ForbiddenException(detail="You can only delete your own resources.")

    resource.deleted_at = datetime.now(timezone.utc)
    await db.flush()

  # ── Study Groups ──────────────────────────────────────────────────

  async def create_study_group(
      self,
      user_id: uuid.UUID,
      course_id: uuid.UUID,
      data: StudyGroupCreate,
      db: AsyncSession,
  ) -> StudyGroup:
    """Create a study group within a course. Creator must be a course member."""
    course_check = await db.execute(select(Course).where(Course.id == course_id))
    if course_check.scalar_one_or_none() is None:
      raise NotFoundException(detail="Course not found.")

    member_check = await db.execute(
        select(CourseMember).where(
            CourseMember.course_id == course_id, CourseMember.user_id == user_id
        )
    )
    if member_check.scalar_one_or_none() is None:
      raise ForbiddenException(detail="You must join the course before creating a study group.")

    group = StudyGroup(
        course_id=course_id,
        name=data.name.strip(),
        description=data.description.strip() if data.description else None,
        max_members=data.max_members,
        created_by=user_id,
    )
    db.add(group)
    await db.flush()

    # Auto-add creator as a member
    membership = StudyGroupMember(study_group_id=group.id, user_id=user_id)
    db.add(membership)
    await db.flush()

    return group

  async def get_study_groups(
      self,
      course_id: uuid.UUID,
      user_id: uuid.UUID,
      db: AsyncSession,
  ) -> list[StudyGroup]:
    """List study groups for a course with membership info."""
    course_check = await db.execute(select(Course).where(Course.id == course_id))
    if course_check.scalar_one_or_none() is None:
      raise NotFoundException(detail="Course not found.")

    result = await db.execute(
        select(StudyGroup).where(StudyGroup.course_id == course_id).order_by(StudyGroup.created_at.desc())
    )
    groups = list(result.scalars().all())

    for group in groups:
      m_count = await db.execute(
          select(func.count(StudyGroupMember.id)).where(StudyGroupMember.study_group_id == group.id)
      )
      group.member_count = m_count.scalar() or 0

      member_check = await db.execute(
          select(StudyGroupMember).where(
              StudyGroupMember.study_group_id == group.id, StudyGroupMember.user_id == user_id
          )
      )
      group.is_member = member_check.scalar_one_or_none() is not None

    return groups

  async def join_study_group(
      self,
      user_id: uuid.UUID,
      group_id: uuid.UUID,
      db: AsyncSession,
  ) -> None:
    """Join a study group. Checks capacity."""
    result = await db.execute(select(StudyGroup).where(StudyGroup.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
      raise NotFoundException(detail="Study group not found.")

    # Check capacity
    m_count = await db.execute(
        select(func.count(StudyGroupMember.id)).where(StudyGroupMember.study_group_id == group.id)
    )
    current_count = m_count.scalar() or 0
    if current_count >= group.max_members:
      raise BadRequestException(detail="Study group is full.")

    # Check duplicate
    existing = await db.execute(
        select(StudyGroupMember).where(
            StudyGroupMember.study_group_id == group.id, StudyGroupMember.user_id == user_id
        )
    )
    if existing.scalar_one_or_none():
      return  # Already a member

    membership = StudyGroupMember(study_group_id=group.id, user_id=user_id)
    db.add(membership)
    await db.flush()

  async def leave_study_group(
      self,
      user_id: uuid.UUID,
      group_id: uuid.UUID,
      db: AsyncSession,
  ) -> None:
    """Leave a study group."""
    result = await db.execute(
        select(StudyGroupMember).where(
            StudyGroupMember.study_group_id == group.id, StudyGroupMember.user_id == user_id
        )
    )
    member = result.scalar_one_or_none()
    if not member:
      raise NotFoundException(detail="You are not a member of this study group.")

    await db.delete(member)
    await db.flush()


def get_academic_service() -> AcademicService:
  """Return an AcademicService instance."""
  return AcademicService()
