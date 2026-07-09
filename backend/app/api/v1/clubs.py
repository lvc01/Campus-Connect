import uuid
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_role
from app.core.exceptions import NotFoundException
from app.core.rate_limiter import rate_limit
from app.models.club import ClubCategory
from app.models.user import User, UserRole
from app.schemas.club import ClubCreate, ClubMemberResponse, ClubResponse, ClubRoleUpdate, ClubUpdate
from app.schemas.common import MessageResponse
from app.services.club_service import get_club_service

router = APIRouter(prefix="/clubs", tags=["Clubs"])


@router.post(
    "",
    response_model=ClubResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Request a new campus society",
    dependencies=[Depends(rate_limit(max_requests=5, window_seconds=3600))],
)
async def create_club(
    data: ClubCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ClubResponse:
  """
  Request registration for a new student society.
  Initializes as unapproved (requires moderator review).
  """
  club_service = get_club_service()
  club = await club_service.create_club(current_user.id, data, db)
  
  # Map Response
  response = ClubResponse.model_validate(club)
  response.is_member = True
  response.member_role = club.members[0].role if club.members else None
  return response


@router.get(
    "",
    response_model=list[ClubResponse],
    summary="Get approved campus societies",
)
async def get_clubs(
    category: ClubCategory | None = Query(default=None),
    search: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ClubResponse]:
  """
  Retrieve all approved campus clubs sorted by popularity.
  Includes filters for category and text searches.
  """
  club_service = get_club_service()
  clubs = await club_service.get_clubs(db, category, search, only_approved=True)
  
  memberships_map = await club_service.get_user_memberships(
      current_user.id, [c.id for c in clubs], db
  )
  
  responses = []
  for club in clubs:
    res = ClubResponse.model_validate(club)
    membership = memberships_map.get(club.id)
    res.is_member = membership is not None and membership.status.value == "approved"
    res.is_pending = membership is not None and membership.status.value == "pending"
    res.member_role = membership.role if membership else None
    responses.append(res)
    
  return responses


@router.get(
    "/admin/pending",
    response_model=list[ClubResponse],
    summary="Get all pending club requests",
)
async def get_pending_clubs(
    current_user: User = Depends(require_role(UserRole.moderator)),
    db: AsyncSession = Depends(get_db),
) -> list[ClubResponse]:
  """
  List all pending club requests awaiting approval.
  Restricted to campus moderators.
  """
  club_service = get_club_service()
  clubs = await club_service.get_clubs(db, only_approved=False)
  pending_clubs = [c for c in clubs if not c.is_approved]
  return [ClubResponse.model_validate(c) for c in pending_clubs]


@router.get(
    "/{slug}",
    response_model=ClubResponse,
    summary="Get single society details by slug",
)
async def get_club_by_slug(
    slug: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ClubResponse:
  """Retrieve details of a society by its unique slug."""
  club_service = get_club_service()
  club = await club_service.get_club_by_slug(slug, db)
  if not club:
    raise NotFoundException(detail="Society not found.")

  response = ClubResponse.model_validate(club)
  membership = await club_service.check_user_membership(current_user.id, club.id, db)
  response.is_member = membership is not None and membership.status.value == "approved"
  response.is_pending = membership is not None and membership.status.value == "pending"
  response.member_role = membership.role if membership else None
  return response


@router.patch(
    "/{club_id}",
    response_model=ClubResponse,
    summary="Update society details",
)
async def update_club(
    club_id: uuid.UUID,
    data: ClubUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ClubResponse:
  """
  Update society details (description, logo, banner).
  Restricted to society owners or administrators.
  """
  club_service = get_club_service()
  club = await club_service.update_club(club_id, current_user.id, data, db)
  response = ClubResponse.model_validate(club)
  membership = await club_service.check_user_membership(current_user.id, club.id, db)
  response.is_member = True
  response.member_role = membership.role if membership else None
  return response


@router.post(
    "/{club_id}/join",
    response_model=MessageResponse,
    summary="Join a society",
)
async def join_club(
    club_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
  """Join a campus club. May require approval based on club settings."""
  club_service = get_club_service()
  result = await club_service.join_club(current_user.id, club_id, db)
  if result == "pending":
    return MessageResponse(message="Join request sent. Awaiting approval.")
  return MessageResponse(message="Successfully joined the society.")


@router.delete(
    "/{club_id}/join",
    response_model=MessageResponse,
    summary="Leave a society",
)
async def leave_club(
    club_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
  """Leave a campus club and decrement its counter."""
  club_service = get_club_service()
  await club_service.leave_club(current_user.id, club_id, db)
  return MessageResponse(message="Successfully left the society.")


@router.get(
    "/{club_id}/members",
    response_model=list[ClubMemberResponse],
    summary="Get members list of a society",
)
async def get_club_members(
    club_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ClubMemberResponse]:
  """Retrieve the list of members and roles for a society."""
  club_service = get_club_service()
  members = await club_service.get_club_members(club_id, db)
  return [ClubMemberResponse.model_validate(m) for m in members]


@router.get(
    "/{club_id}/members/pending",
    response_model=list[ClubMemberResponse],
    summary="Get pending membership requests",
)
async def get_pending_members(
    club_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ClubMemberResponse]:
  """Retrieve pending membership requests. Owner/admin only."""
  club_service = get_club_service()
  pending = await club_service.get_pending_members(club_id, db)
  return [ClubMemberResponse.model_validate(m) for m in pending]


@router.post(
    "/{club_id}/members/{user_id}/approve",
    response_model=ClubMemberResponse,
    summary="Approve a membership request",
)
async def approve_member(
    club_id: uuid.UUID,
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ClubMemberResponse:
  """Approve a pending membership request. Owner/admin only."""
  club_service = get_club_service()
  member = await club_service.approve_member(club_id, user_id, current_user.id, db)
  return ClubMemberResponse.model_validate(member)


@router.post(
    "/{club_id}/members/{user_id}/reject",
    response_model=MessageResponse,
    summary="Reject a membership request",
)
async def reject_member(
    club_id: uuid.UUID,
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
  """Reject a pending membership request. Owner/admin only."""
  club_service = get_club_service()
  await club_service.reject_member(club_id, user_id, current_user.id, db)
  return MessageResponse(message="Membership request rejected.")


# ── Moderator Gate Controllers ──────────────────────────────────────

@router.patch(
    "/{club_id}/approve",
    response_model=ClubResponse,
    summary="Approve society request",
)
async def approve_club(
    club_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.moderator)),
    db: AsyncSession = Depends(get_db),
) -> ClubResponse:
  """Approve a club, making it discoverable. Gated to moderators."""
  club_service = get_club_service()
  club = await club_service.approve_club(club_id, db)
  return ClubResponse.model_validate(club)


@router.patch(
    "/{club_id}/verify",
    response_model=ClubResponse,
    summary="Toggle verified badge",
)
async def verify_club(
    club_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.moderator)),
    db: AsyncSession = Depends(get_db),
) -> ClubResponse:
  """Toggle verified status badge. Gated to moderators."""
  club_service = get_club_service()
  club = await club_service.verify_club(club_id, db)
  return ClubResponse.model_validate(club)


@router.patch(
    "/{club_id}/members/{user_id}/role",
    response_model=ClubMemberResponse,
    summary="Update a member's role",
)
async def update_member_role(
    club_id: uuid.UUID,
    user_id: uuid.UUID,
    data: ClubRoleUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ClubMemberResponse:
  """Promote or demote a club member. Restricted to club owner."""
  club_service = get_club_service()
  member = await club_service.update_member_role(club_id, user_id, data.role, current_user.id, db)
  return ClubMemberResponse.model_validate(member)


@router.delete(
    "/{club_id}/members/{user_id}",
    response_model=MessageResponse,
    summary="Remove a member from the club",
)
async def kick_member(
    club_id: uuid.UUID,
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
  """Remove a member from the club. Restricted to owners/admins."""
  club_service = get_club_service()
  await club_service.kick_member(club_id, user_id, current_user.id, db)
  return MessageResponse(message="Member removed from the club.")


@router.delete(
    "/{club_id}",
    response_model=MessageResponse,
    summary="Delete a club",
)
async def delete_club(
    club_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
  """Soft-delete a club. Restricted to club owner."""
  club_service = get_club_service()
  await club_service.delete_club(club_id, current_user.id, db)
  return MessageResponse(message="Club deleted successfully.")
