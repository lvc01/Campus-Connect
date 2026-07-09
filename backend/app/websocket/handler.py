"""
FastAPI WebSocket endpoint — handles real-time messaging, typing indicators,
and read receipts.

Protocol (JSON frames, both directions):
  - ``{"type": "message", "payload": {"conversation_id": "...", "content": "..."}}``
  - ``{"type": "typing", "payload": {"conversation_id": "...", "is_typing": true}}``
  - ``{"type": "read", "payload": {"conversation_id": "..."}}``

Security measures:
  - Authentication via ``Sec-WebSocket-Protocol`` header only (no query-param auth).
  - Per-connection rate limit: 100 messages per 60-second sliding window.
  - Maximum message size: 64 KB.
  - Conversation membership verified before every broadcast.
  - Internal error details never leak to clients.
"""

import json
import logging
import time
import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import AsyncSessionLocal
from app.core.security import decode_token
from app.models.messaging import ConversationMember
from app.models.user import User
from app.schemas.messaging import MessageResponse, SendMessageRequest
from app.services.messaging_service import get_messaging_service
from app.websocket.manager import manager

logger = logging.getLogger(__name__)
messaging_service = get_messaging_service()

ws_router = APIRouter()

# ── Security constants ────────────────────────────────────────────────
_MAX_MESSAGE_BYTES = 64 * 1024  # 64 KB
_RATE_WINDOW_SECONDS = 60
_RATE_MAX_MESSAGES = 100


class _RateLimiter:
    """Sliding-window message rate limiter per WebSocket connection."""

    def __init__(self) -> None:
        self._timestamps: list[float] = []

    def allow(self) -> bool:
        now = time.monotonic()
        cutoff = now - _RATE_WINDOW_SECONDS
        self._timestamps = [t for t in self._timestamps if t > cutoff]
        if len(self._timestamps) >= _RATE_MAX_MESSAGES:
            return False
        self._timestamps.append(now)
        return True


async def _get_db_session() -> AsyncSession:
    """Create a short-lived session for a single WS message handler call."""
    return AsyncSessionLocal()


async def _check_membership(user_id: str, conv_id: str, db: AsyncSession) -> list[str]:
    """Return conversation member IDs after verifying the sender is a member.

    Raises ``PermissionError`` if the user is not a member.
    """
    members_result = await db.execute(
        select(ConversationMember).where(
            ConversationMember.conversation_id == conv_id,
        )
    )
    members = members_result.scalars().all()
    member_ids = [str(m.user_id) for m in members]
    if user_id not in member_ids:
        raise PermissionError("Not a conversation member")
    return member_ids


@ws_router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for real-time messaging.

    Authentication:
        ``Sec-WebSocket-Protocol`` header — a JWT with ``type: "ws"``
        obtained from ``POST /auth/ws-token``.

    On connect, resolves the user and prepares for bidirectional
    JSON messaging.
    """
    # ── Auth — Sec-WebSocket-Protocol only ─────────────────────────────
    protocol_header = websocket.headers.get("sec-websocket-protocol", "")
    token = protocol_header if protocol_header else None

    if not token:
        await websocket.close(code=4001, reason="Missing token")
        return

    try:
        payload = decode_token(token, token_type="ws")
        user_id_str = payload.get("sub")
        if not user_id_str:
            await websocket.close(code=4001, reason="Invalid token payload")
            return
    except Exception:
        await websocket.close(code=4001, reason="Invalid token")
        return

    # Validate that the token's ``sub`` claim is a real UUID before using it
    # in a query. Without this, malformed tokens with arbitrary ``sub`` values
    # would either crash the ORM cast or be silently coerced to a no-match
    # filter, leaving the WebSocket in a half-open state.
    try:
        user_uuid = uuid.UUID(user_id_str)
    except (ValueError, AttributeError, TypeError):
        await websocket.close(code=4001, reason="Invalid token payload")
        return

    # Resolve user for conversation membership checks using a short-lived session
    async with AsyncSessionLocal() as session:
        user_result = await session.execute(
            select(User).options(selectinload(User.profile)).where(User.id == user_uuid)
        )
        user = user_result.scalar_one_or_none()

    if not user or not user.is_active:
        await websocket.close(code=4001, reason="User not found or inactive")
        return

    user_id = user_id_str

    # ── Accept & track ───────────────────────────────────────────────
    # Echo the subprotocol back so browsers keep the connection open.
    await manager.connect(user_id, websocket, subprotocol=protocol_header or None)
    rate_limiter = _RateLimiter()

    try:
        while True:
            raw = await websocket.receive_text()

            # Size limit
            if len(raw.encode("utf-8")) > _MAX_MESSAGE_BYTES:
                await manager.send_to_user(user_id, {
                    "type": "error",
                    "payload": {"detail": "Message too large."},
                })
                continue

            # Rate limit
            if not rate_limiter.allow():
                await manager.send_to_user(user_id, {
                    "type": "error",
                    "payload": {"detail": "Rate limit exceeded. Please slow down."},
                })
                continue

            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                continue

            msg_type = data.get("type")
            payload_data = data.get("payload", {})

            try:
                if msg_type == "message":
                    await _handle_message(user_id, payload_data)
                elif msg_type == "typing":
                    await _handle_typing(user_id, payload_data)
                elif msg_type == "read":
                    await _handle_read(user_id, payload_data)
                elif msg_type == "ping":
                    await manager.send_to_user(user_id, {"type": "pong"})
            except PermissionError:
                # Membership check failed — silently ignore (no detail leak)
                logger.warning(
                    "WS membership denied user=%s type=%s conv=%s",
                    user_id,
                    msg_type,
                    payload_data.get("conversation_id"),
                )
            except Exception as e:
                logger.error("WS handler error for user=%s type=%s: %s", user_id, msg_type, e)
                await manager.send_to_user(user_id, {
                    "type": "error",
                    "payload": {"detail": "An error occurred."},
                })

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error("WS error for user=%s: %s", user_id, e)
    finally:
        await manager.disconnect(user_id, websocket)


async def _handle_message(user_id: str, payload: dict) -> None:
    """Handle an incoming WebSocket message — persist and broadcast."""
    conv_id = payload.get("conversation_id")
    content = payload.get("content", "").strip()
    if not conv_id or not content:
        return

    # Enforce the same 5000-char cap the REST SendMessageRequest schema uses.
    # The WS path bypasses Pydantic validation, so without this a client could
    # send arbitrarily large messages over the socket.
    if len(content) > 5000:
        await manager.send_to_user(user_id, {
            "type": "error",
            "payload": {"detail": "Message exceeds the 5000-character limit."},
        })
        return

    async with AsyncSessionLocal() as db:
        member_ids = await _check_membership(user_id, conv_id, db)

        msg = await messaging_service.send_message(
            conv_id,
            user_id,
            SendMessageRequest(content=content),
            db,
        )
        await db.commit()

    msg_resp = MessageResponse.model_validate(msg)

    broadcast = {
        "type": "new_message",
        "payload": msg_resp.model_dump(mode="json"),
    }

    await manager.send_to_conversation(
        conv_id,
        broadcast,
        exclude_user_id=user_id,
        member_user_ids=member_ids,
    )

    # Also send back to sender to confirm delivery
    await manager.send_to_user(user_id, broadcast)


async def _handle_typing(user_id: str, payload: dict) -> None:
    """Relay typing indicator to conversation members only."""
    conv_id = payload.get("conversation_id")
    is_typing = payload.get("is_typing", False)
    if not conv_id:
        return

    async with AsyncSessionLocal() as db:
        member_ids = await _check_membership(user_id, conv_id, db)

    broadcast = {
        "type": "typing",
        "payload": {
            "conversation_id": conv_id,
            "user_id": user_id,
            "is_typing": is_typing,
        },
    }
    await manager.send_to_conversation(
        conv_id,
        broadcast,
        exclude_user_id=user_id,
        member_user_ids=member_ids,
    )


async def _handle_read(user_id: str, payload: dict) -> None:
    """Mark a conversation as read and notify others."""
    conv_id = payload.get("conversation_id")
    if not conv_id:
        return

    async with AsyncSessionLocal() as db:
        member_ids = await _check_membership(user_id, conv_id, db)

        last_read_at = await messaging_service.mark_conversation_read(conv_id, user_id, db)
        await db.commit()

    broadcast = {
        "type": "read",
        "payload": {
            "conversation_id": conv_id,
            "user_id": user_id,
            "last_read_at": last_read_at.isoformat(),
        },
    }
    await manager.send_to_conversation(
        conv_id,
        broadcast,
        exclude_user_id=user_id,
        member_user_ids=member_ids,
    )
    await manager.send_to_user(user_id, broadcast)
