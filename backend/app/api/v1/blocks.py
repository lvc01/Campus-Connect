"""
User block API endpoints — block/unblock users and check block status.
"""

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import BadRequestException, NotFoundException
from app.models.user import User
from app.models.user_block import UserBlock
from app.schemas.common import MessageResponse

router = APIRouter(prefix="/users", tags=["Users"])


@router.post(
    "/{user_id}/block",
    response_model=MessageResponse,
    summary="Block a user",
)
async def block_user(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """Block a user. They won't see your content and can't message you."""
    if user_id == current_user.id:
        raise BadRequestException(detail="You cannot block yourself.")

    # Check target exists
    target = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
    if not target.scalar_one_or_none():
        raise NotFoundException(detail="User not found.")

    # Check if already blocked
    existing = await db.execute(
        select(UserBlock).where(
            UserBlock.blocker_id == current_user.id,
            UserBlock.blocked_id == user_id,
        )
    )
    if existing.scalar_one_or_none():
        return MessageResponse(message="User is already blocked.")

    block = UserBlock(blocker_id=current_user.id, blocked_id=user_id)
    db.add(block)
    await db.commit()
    return MessageResponse(message="User blocked.")


@router.delete(
    "/{user_id}/block",
    response_model=MessageResponse,
    summary="Unblock a user",
)
async def unblock_user(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """Remove a block from a user."""
    result = await db.execute(
        select(UserBlock).where(
            UserBlock.blocker_id == current_user.id,
            UserBlock.blocked_id == user_id,
        )
    )
    block = result.scalar_one_or_none()
    if not block:
        raise NotFoundException(detail="Block not found.")

    await db.delete(block)
    await db.commit()
    return MessageResponse(message="User unblocked.")


@router.get(
    "/me/blocks",
    summary="List blocked users",
)
async def list_blocked_users(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Return a list of users the current user has blocked."""
    result = await db.execute(
        select(UserBlock).where(UserBlock.blocker_id == current_user.id)
    )
    blocks = result.scalars().all()

    blocked_ids = [b.blocked_id for b in blocks]
    if not blocked_ids:
        return []

    users_result = await db.execute(
        select(User).where(User.id.in_(blocked_ids))
    )
    users = {u.id: u for u in users_result.scalars().all()}

    return [
        {
            "id": str(b.blocked_id),
            "email": users[b.blocked_id].email if b.blocked_id in users else "",
            "display_name": (
                users[b.blocked_id].profile.display_name
                if b.blocked_id in users and users[b.blocked_id].profile
                else ""
            ),
        }
        for b in blocks
    ]
