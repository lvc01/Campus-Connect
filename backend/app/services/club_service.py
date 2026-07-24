import re
import uuid
from sqlalchemy import and_, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import BadRequestException, ConflictException, ForbiddenException, NotFoundException
from app.models.club import Club, ClubCategory, ClubMember, ClubMemberRole, ClubMemberStatus
from app.models.user import User
from app.schemas.club import ClubCreate, ClubUpdate


class ClubService:
  """Handles all campus society lifecycles, memberships, updates, and approvals."""

  # ── Club Creation & Slugification ──────────────────────────────────

  async def create_club(
      self,
      creator_id: uuid.UUID,
      data: ClubCreate,
      db: AsyncSession,
  ) -> Club:
    """
    Request a new society. Generates a unique slug and auto-adds creator as owner.
    """
    # 1. Generate unique slug from club name
    base_slug = re.sub(r"[^a-z0-9]+", "-", data.name.lower()).strip("-")
    if not base_slug:
      base_slug = "club"
    
    slug = base_slug
    counter = 1
    
    while True:
      existing = await db.execute(select(Club).where(Club.slug == slug))
      if existing.scalar_one_or_none() is None:
        break
      slug = f"{base_slug}-{counter}"
      counter += 1

    # 2. Create the Club record (defaulting is_approved = False)
    club = Club(
        name=data.name.strip(),
        slug=slug,
        description=data.description.strip() if data.description else None,
        category=data.category,
        banner_url=data.banner_url,
        logo_url=data.logo_url,
        requires_approval=data.requires_approval,
        created_by=creator_id,
        member_count=1,  # Starts with the creator as first member
    )
    db.add(club)
    await db.flush()

    # 3. Auto-associate creator as Owner membership role
    membership = ClubMember(
        club_id=club.id,
        user_id=creator_id,
        role=ClubMemberRole.owner,
    )
    db.add(membership)
    await db.flush()

    # Refresh to eager load relationships
    result = await db.execute(
        select(Club)
        .options(
            selectinload(Club.creator).selectinload(User.profile),
            selectinload(Club.members),
        )
        .where(Club.id == club.id)
    )
    return result.scalar_one()

  # ── List & Discovery ────────────────────────────────────────────────

  async def get_clubs(
      self,
      db: AsyncSession,
      category: ClubCategory | None = None,
      search: str | None = None,
      only_approved: bool = True,
  ) -> list[Club]:
    """
    Retrieve societies sorted by popularity (member count).
    """
    query = select(Club).options(selectinload(Club.creator).selectinload(User.profile))

    if only_approved:
      query = query.where(Club.is_approved == True)  # noqa: E712
    
    query = query.where(Club.deleted_at.is_(None))

    if category:
      query = query.where(Club.category == category)

    if search:
      search_term = f"%{search.strip()}%"
      query = query.where(
          or_(
              Club.name.ilike(search_term),
              Club.description.ilike(search_term),
          )
      )

    # Sort by size (popularity) first, then alphabetically by name
    query = query.order_by(Club.member_count.desc(), Club.name.asc())
    
    result = await db.execute(query)
    return list(result.scalars().all())

  async def get_club_by_slug(
      self,
      slug: str,
      db: AsyncSession,
  ) -> Club | None:
    """Fetch a single club profile details by unique slug."""
    result = await db.execute(
        select(Club)
        .options(selectinload(Club.creator).selectinload(User.profile))
        .where(Club.slug == slug, Club.deleted_at.is_(None))
    )
    return result.scalar_one_or_none()

  # ── Membership Toggles ──────────────────────────────────────────────

  async def join_club(
      self,
      user_id: uuid.UUID,
      club_id: uuid.UUID,
      db: AsyncSession,
  ) -> str:
    """Join a society. Returns 'joined' or 'pending' based on club policy."""
    club_check = await db.execute(select(Club).where(Club.id == club_id))
    club = club_check.scalar_one_or_none()
    if not club:
      raise NotFoundException(detail="Club not found.")

    if not club.is_approved:
      raise BadRequestException(detail="Cannot join an unapproved club.")

    # Check already member
    existing = await db.execute(
        select(ClubMember).where(
            ClubMember.club_id == club_id, ClubMember.user_id == user_id
        )
    )
    existing_member = existing.scalar_one_or_none()
    if existing_member is not None:
      if existing_member.status == ClubMemberStatus.pending:
        return "pending"
      return "joined"

    # Determine status based on club policy
    status = ClubMemberStatus.pending if club.requires_approval else ClubMemberStatus.approved

    membership = ClubMember(
        club_id=club_id,
        user_id=user_id,
        role=ClubMemberRole.member,
        status=status,
    )
    db.add(membership)

    # Only increment counter for immediate approvals
    if status == ClubMemberStatus.approved:
      await db.execute(
          update(Club).where(Club.id == club_id).values(member_count=Club.member_count + 1)
      )
    await db.flush()

    return status.value

  async def leave_club(
      self,
      user_id: uuid.UUID,
      club_id: uuid.UUID,
      db: AsyncSession,
  ) -> None:
    """Leave a society and atomically decrement count. Restricts owners."""
    existing = await db.execute(
        select(ClubMember).where(
            ClubMember.club_id == club_id, ClubMember.user_id == user_id
        )
    )
    membership = existing.scalar_one_or_none()
    if not membership:
      return  # Not a member

    if membership.role == ClubMemberRole.owner:
      raise BadRequestException(
          detail="Club owners cannot leave the club. Please transfer ownership first."
      )

    was_approved = membership.status == ClubMemberStatus.approved
    await db.delete(membership)

    # Only decrement counter if they were an approved member
    if was_approved:
      await db.execute(
          update(Club).where(Club.id == club_id).values(member_count=Club.member_count - 1)
      )
    await db.flush()

  # ── Management & Update Permissions ─────────────────────────────────

  async def update_club(
      self,
      club_id: uuid.UUID,
      user_id: uuid.UUID,
      data: ClubUpdate,
      db: AsyncSession,
  ) -> Club:
    """Update club profile info. Restricted to Owners or Admins."""
    member_check = await db.execute(
        select(ClubMember).where(
            ClubMember.club_id == club_id, ClubMember.user_id == user_id
        )
    )
    member = member_check.scalar_one_or_none()
    if not member or member.role not in [ClubMemberRole.owner, ClubMemberRole.admin]:
      raise ForbiddenException(
          detail="You do not have permission to manage this club."
      )

    club_check = await db.execute(select(Club).where(Club.id == club_id))
    club = club_check.scalar_one()

    if data.description is not None:
      club.description = data.description.strip() if data.description else None
    if data.banner_url is not None:
      club.banner_url = data.banner_url.strip() if data.banner_url else None
    if data.logo_url is not None:
      club.logo_url = data.logo_url.strip() if data.logo_url else None
    if data.requires_approval is not None:
      club.requires_approval = data.requires_approval

    await db.flush()
    return club

  # ── Membership Approval ─────────────────────────────────────────────

  async def approve_member(
      self,
      club_id: uuid.UUID,
      target_user_id: uuid.UUID,
      requester_id: uuid.UUID,
      db: AsyncSession,
  ) -> ClubMember:
    """Approve a pending membership request. Owner/admin only."""
    requester_check = await db.execute(
        select(ClubMember).where(
            ClubMember.club_id == club_id, ClubMember.user_id == requester_id
        )
    )
    requester = requester_check.scalar_one_or_none()
    if not requester or requester.role not in [ClubMemberRole.owner, ClubMemberRole.admin]:
      raise ForbiddenException(detail="You do not have permission to approve members.")

    target_check = await db.execute(
        select(ClubMember).where(
            ClubMember.club_id == club_id, ClubMember.user_id == target_user_id
        )
    )
    target = target_check.scalar_one_or_none()
    if not target:
      raise NotFoundException(detail="Member not found in this club.")

    if target.status != ClubMemberStatus.pending:
      raise BadRequestException(detail="This membership request is not pending.")

    target.status = ClubMemberStatus.approved

    # Increment member count
    await db.execute(
        update(Club).where(Club.id == club_id).values(member_count=Club.member_count + 1)
    )
    await db.flush()

    result = await db.execute(
        select(ClubMember)
        .options(selectinload(ClubMember.user).selectinload(User.profile))
        .where(ClubMember.id == target.id)
    )
    return result.scalar_one()

  async def reject_member(
      self,
      club_id: uuid.UUID,
      target_user_id: uuid.UUID,
      requester_id: uuid.UUID,
      db: AsyncSession,
  ) -> None:
    """Reject a pending membership request. Owner/admin only."""
    requester_check = await db.execute(
        select(ClubMember).where(
            ClubMember.club_id == club_id, ClubMember.user_id == requester_id
        )
    )
    requester = requester_check.scalar_one_or_none()
    if not requester or requester.role not in [ClubMemberRole.owner, ClubMemberRole.admin]:
      raise ForbiddenException(detail="You do not have permission to reject members.")

    target_check = await db.execute(
        select(ClubMember).where(
            ClubMember.club_id == club_id, ClubMember.user_id == target_user_id
        )
    )
    target = target_check.scalar_one_or_none()
    if not target:
      raise NotFoundException(detail="Member not found in this club.")

    if target.status != ClubMemberStatus.pending:
      raise BadRequestException(detail="This membership request is not pending.")

    # Delete the pending membership request
    await db.delete(target)
    await db.flush()

  async def get_pending_members(
      self,
      club_id: uuid.UUID,
      db: AsyncSession,
  ) -> list[ClubMember]:
    """Retrieve pending membership requests for a club."""
    result = await db.execute(
        select(ClubMember)
        .options(selectinload(ClubMember.user).selectinload(User.profile))
        .where(
            ClubMember.club_id == club_id,
            ClubMember.status == ClubMemberStatus.pending,
        )
        .order_by(ClubMember.joined_at.asc())
    )
    return list(result.scalars().all())

  async def update_member_role(
      self,
      club_id: uuid.UUID,
      target_user_id: uuid.UUID,
      new_role: ClubMemberRole,
      requester_id: uuid.UUID,
      db: AsyncSession,
  ) -> ClubMember:
    """Update a member's role. Only owners can promote/demote."""
    requester_check = await db.execute(
        select(ClubMember).where(
            ClubMember.club_id == club_id, ClubMember.user_id == requester_id
        )
    )
    requester = requester_check.scalar_one_or_none()
    if not requester or requester.role != ClubMemberRole.owner:
      raise ForbiddenException(detail="Only the club owner can change member roles.")

    if str(target_user_id) == str(requester_id):
      raise BadRequestException(detail="You cannot change your own role.")

    target_check = await db.execute(
        select(ClubMember).where(
            ClubMember.club_id == club_id, ClubMember.user_id == target_user_id
        )
    )
    target = target_check.scalar_one_or_none()
    if not target:
      raise NotFoundException(detail="Member not found in this club.")

    target.role = new_role
    await db.flush()

    result = await db.execute(
        select(ClubMember)
        .options(selectinload(ClubMember.user).selectinload(User.profile))
        .where(ClubMember.id == target.id)
    )
    return result.scalar_one()

  async def kick_member(
      self,
      club_id: uuid.UUID,
      target_user_id: uuid.UUID,
      requester_id: uuid.UUID,
      db: AsyncSession,
  ) -> None:
    """Remove a member from the club. Owners/admins can kick members, but not owners."""
    requester_check = await db.execute(
        select(ClubMember).where(
            ClubMember.club_id == club_id, ClubMember.user_id == requester_id
        )
    )
    requester = requester_check.scalar_one_or_none()
    if not requester or requester.role not in [ClubMemberRole.owner, ClubMemberRole.admin]:
      raise ForbiddenException(detail="You do not have permission to remove members.")

    if str(target_user_id) == str(requester_id):
      raise BadRequestException(detail="You cannot remove yourself.")

    target_check = await db.execute(
        select(ClubMember).where(
            ClubMember.club_id == club_id, ClubMember.user_id == target_user_id
        )
    )
    target = target_check.scalar_one_or_none()
    if not target:
      raise NotFoundException(detail="Member not found.")

    if target.role == ClubMemberRole.owner:
      raise BadRequestException(detail="Cannot remove the club owner.")

    await db.delete(target)
    await db.execute(
        update(Club).where(Club.id == club_id).values(member_count=Club.member_count - 1)
    )
    await db.flush()

  async def delete_club(
      self,
      club_id: uuid.UUID,
      user_id: uuid.UUID,
      db: AsyncSession,
  ) -> None:
    """Soft-delete a club. Only the owner can do this."""
    member_check = await db.execute(
        select(ClubMember).where(
            ClubMember.club_id == club_id, ClubMember.user_id == user_id
        )
    )
    member = member_check.scalar_one_or_none()
    if not member or member.role != ClubMemberRole.owner:
      raise ForbiddenException(detail="Only the club owner can delete the club.")

    club_check = await db.execute(select(Club).where(Club.id == club_id))
    club = club_check.scalar_one_or_none()
    if not club:
      raise NotFoundException(detail="Club not found.")

    from datetime import datetime, timezone
    club.deleted_at = datetime.now(timezone.utc)
    club.is_approved = False
    await db.flush()

  async def get_club_members(
      self,
      club_id: uuid.UUID,
      db: AsyncSession,
      include_pending: bool = False,
  ) -> list[ClubMember]:
    """Retrieve society members sorted by authority and join date."""
    query = (
        select(ClubMember)
        .options(selectinload(ClubMember.user).selectinload(User.profile))
        .where(ClubMember.club_id == club_id)
    )
    if not include_pending:
      query = query.where(ClubMember.status == ClubMemberStatus.approved)
    
    result = await db.execute(
        query.order_by(
            ClubMember.role.desc(),  # owner -> admin -> member
            ClubMember.joined_at.asc(),
        )
    )
    return list(result.scalars().all())

  async def check_user_membership(
      self,
      user_id: uuid.UUID,
      club_id: uuid.UUID,
      db: AsyncSession,
  ) -> ClubMember | None:
    """Return the membership row if exists."""
    result = await db.execute(
        select(ClubMember).where(
            ClubMember.club_id == club_id, ClubMember.user_id == user_id
        )
    )
    return result.scalar_one_or_none()

  async def get_user_memberships(
      self,
      user_id: uuid.UUID,
      club_ids: list[uuid.UUID],
      db: AsyncSession,
  ) -> dict[uuid.UUID, ClubMember]:
    """Return a mapping of club_id -> ClubMember for the given user in bulk."""
    if not club_ids:
      return {}
    result = await db.execute(
        select(ClubMember).where(
            ClubMember.user_id == user_id,
            ClubMember.club_id.in_(club_ids),
        )
    )
    return {m.club_id: m for m in result.scalars().all()}

  # ── Moderator Gates ────────────────────────────────────────────────

  async def approve_club(
      self,
      club_id: uuid.UUID,
      db: AsyncSession,
  ) -> Club:
    """Approve a club, making it public in the directory."""
    club_check = await db.execute(select(Club).where(Club.id == club_id))
    club = club_check.scalar_one_or_none()
    if not club:
      raise NotFoundException(detail="Club not found.")

    club.is_approved = True
    await db.flush()
    return club

  async def verify_club(
      self,
      club_id: uuid.UUID,
      db: AsyncSession,
  ) -> Club:
    """Toggle the verified badge for a club."""
    club_check = await db.execute(select(Club).where(Club.id == club_id))
    club = club_check.scalar_one_or_none()
    if not club:
      raise NotFoundException(detail="Club not found.")

    club.is_verified = not club.is_verified
    await db.flush()
    return club


def get_club_service() -> ClubService:
  """Return a ClubService instance."""
  return ClubService()
