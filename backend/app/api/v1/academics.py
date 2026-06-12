import uuid
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import NotFoundException
from app.models.academic import ResourceType
from app.models.user import User
from app.schemas.academic import CourseResponse, ResourceCreate, ResourceResponse, StudyGroupCreate, StudyGroupResponse
from app.schemas.common import MessageResponse
from app.services.academic_service import get_academic_service

router = APIRouter(prefix="/academics", tags=["Academics"])


@router.get(
    "/courses",
    response_model=list[CourseResponse],
    summary="Get academic courses catalog",
)
async def get_courses(
    faculty: str | None = Query(default=None),
    search: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[CourseResponse]:
  """Retrieve academic courses catalog. Supports search by code/name and faculty filters."""
  academic_service = get_academic_service()
  courses = await academic_service.get_courses(current_user.id, db, faculty, search)
  return [CourseResponse.model_validate(c) for c in courses]


@router.get(
    "/courses/{course_id}",
    response_model=CourseResponse,
    summary="Get single course workspace details",
)
async def get_course(
    course_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CourseResponse:
  """Retrieve details of a single course workspace by ID."""
  academic_service = get_academic_service()
  course = await academic_service.get_course_by_id(course_id, current_user.id, db)
  if not course:
    raise NotFoundException(detail="Course workspace not found.")
  return CourseResponse.model_validate(course)


@router.post(
    "/courses/{course_id}/join",
    response_model=MessageResponse,
    summary="Join a course group workspace",
)
async def join_course(
    course_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
  """Register / join a university course group workspace."""
  academic_service = get_academic_service()
  await academic_service.join_course(current_user.id, course_id, db)
  return MessageResponse(message="Successfully joined the course workspace.")


@router.get(
    "/courses/{course_id}/resources",
    response_model=list[ResourceResponse],
    summary="Get course shared documents",
)
async def get_resources(
    course_id: uuid.UUID,
    resource_type: ResourceType | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ResourceResponse]:
  """Retrieve list of shared study resources (notes, past papers, etc.) under a course."""
  academic_service = get_academic_service()
  resources = await academic_service.get_course_resources(course_id, db, resource_type)
  return [ResourceResponse.model_validate(r) for r in resources]


@router.post(
    "/courses/{course_id}/resources",
    response_model=ResourceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload note/past paper study guides",
)
async def upload_resource(
    course_id: uuid.UUID,
    data: ResourceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ResourceResponse:
  """Upload lecture notes or past papers to a course group. Requires course membership."""
  academic_service = get_academic_service()
  resource = await academic_service.upload_resource(current_user.id, course_id, data, db)
  return ResourceResponse.model_validate(resource)


@router.post(
    "/resources/{resource_id}/download",
    response_model=ResourceResponse,
    summary="Increment study document download count",
)
async def download_resource(
    resource_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ResourceResponse:
  """Register study resource download, incrementing download count."""
  academic_service = get_academic_service()
  resource = await academic_service.increment_download(resource_id, db)
  return ResourceResponse.model_validate(resource)


@router.delete(
    "/courses/{course_id}/join",
    response_model=MessageResponse,
    summary="Leave a course workspace",
)
async def leave_course(
    course_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
  """Leave a course group workspace."""
  academic_service = get_academic_service()
  await academic_service.leave_course(current_user.id, course_id, db)
  return MessageResponse(message="Left the course workspace.")


@router.delete(
    "/resources/{resource_id}",
    response_model=MessageResponse,
    summary="Delete a resource",
)
async def delete_resource(
    resource_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
  """Soft-delete a resource you uploaded."""
  academic_service = get_academic_service()
  await academic_service.delete_resource(resource_id, current_user.id, db)
  return MessageResponse(message="Resource deleted.")


# ── Study Group Routes ─────────────────────────────────────────────


@router.post(
    "/courses/{course_id}/study-groups",
    response_model=StudyGroupResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a study group",
)
async def create_study_group(
    course_id: uuid.UUID,
    data: StudyGroupCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StudyGroupResponse:
  """Create a study group within a course. Creator must be a member."""
  academic_service = get_academic_service()
  group = await academic_service.create_study_group(current_user.id, course_id, data, db)
  return StudyGroupResponse.model_validate(group)


@router.get(
    "/courses/{course_id}/study-groups",
    response_model=list[StudyGroupResponse],
    summary="List study groups for a course",
)
async def get_study_groups(
    course_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[StudyGroupResponse]:
  """List study groups for a course with membership status."""
  academic_service = get_academic_service()
  groups = await academic_service.get_study_groups(course_id, current_user.id, db)
  return [StudyGroupResponse.model_validate(g) for g in groups]


@router.post(
    "/study-groups/{group_id}/join",
    response_model=MessageResponse,
    summary="Join a study group",
)
async def join_study_group(
    group_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
  """Join a study group, subject to capacity limits."""
  academic_service = get_academic_service()
  await academic_service.join_study_group(current_user.id, group_id, db)
  return MessageResponse(message="Joined study group.")


@router.delete(
    "/study-groups/{group_id}/join",
    response_model=MessageResponse,
    summary="Leave a study group",
)
async def leave_study_group(
    group_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
  """Leave a study group."""
  academic_service = get_academic_service()
  await academic_service.leave_study_group(current_user.id, group_id, db)
  return MessageResponse(message="Left study group.")
