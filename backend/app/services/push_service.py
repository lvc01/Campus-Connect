"""
Expo Push Notification delivery service.

Sends push notifications to mobile devices via the Expo Push API
(``https://exp.host/--/api/v2/push/send``). Handles the Expo receipt/resp**flow:

  1. Look up the recipient's active ``UserPushToken`` rows.
  2. POST a batch of notification payloads to Expo.
  3. Deactivate any token Expo reports as invalid (``DeviceNotRegistered``),
     so dead tokens don't accumulate and waste future sends.

This is intentionally best-effort: push failures are logged and never raised
into the caller's path — a notification is still "created" even if the device
is offline. Expo enqueues offline deliveries on their side.
"""

import asyncio
import logging
from typing import Any

import httpx
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.models.user import UserPushToken

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
EXPO_RECEIPT_URL = "https://exp.host/--/api/v2/push/getReceipts"
_REQUEST_TIMEOUT = 10.0


async def send_push_notification(
    user_id: str,
    title: str,
    body: str | None = None,
    data: dict | None = None,
) -> None:
    """Send a push notification to all active devices for a user.

    Best-effort: logs and swallows all errors so a flaky push never breaks
    the notification-creation path. Invalid tokens reported by Expo are
    deactivated in the database.
    """
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(UserPushToken.token).where(
                    UserPushToken.user_id == user_id,
                    UserPushToken.is_active == True,  # noqa: E712
                )
            )
            tokens = [row[0] for row in result.all()]

        if not tokens:
            return  # No registered devices — nothing to do.

        await _send_to_expo(
            tokens=tokens,
            title=title,
            body=body or "",
            data=data or {},
            user_id=user_id,
        )
    except Exception as exc:
        # Never let a push failure propagate into the notification write.
        logger.warning("Push notification to user %s failed: %s", user_id, exc)


async def _send_to_expo(
    tokens: list[str],
    title: str,
    body: str,
    data: dict,
    user_id: str,
) -> None:
    """POST a batch of messages to Expo and prune invalid tokens."""
    messages = [
        {
            "to": token,
            "title": title,
            "body": body,
            "data": data,
            "sound": "default",
            "priority": "high",
        }
        for token in tokens
    ]

    invalid_tokens: set[str] = set()

    async with httpx.AsyncClient(timeout=_REQUEST_TIMEOUT) as client:
        resp = await client.post(
            EXPO_PUSH_URL,
            json=messages,
            headers={
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
        )

        if resp.status_code != 200:
            logger.warning(
                "Expo push API returned %s for user %s: %s",
                resp.status_code,
                user_id,
                resp.text[:200],
            )
            return

        result = _safe_json(resp)
        # Expo returns ``data`` in the same order as the request messages,
        # so we zip tickets with their source tokens to find which ones died.
        tickets = result.get("data", [])
        for token, ticket in zip(tokens, tickets):
            if ticket.get("status") == "ok":
                continue
            # ``DeviceNotRegistered`` means the app was uninstalled or the
            # token is otherwise stale — stop sending to it.
            details = ticket.get("details", {})
            if details.get("error") == "DeviceNotRegistered":
                invalid_tokens.add(token)

    if invalid_tokens:
        await _deactivate_tokens(invalid_tokens)


async def _deactivate_tokens(tokens: set[str]) -> None:
    """Mark dead tokens inactive so they're not retried."""
    if not tokens:
        return
    try:
        async with AsyncSessionLocal() as db:
            await db.execute(
                update(UserPushToken)
                .where(UserPushToken.token.in_(tokens))
                .values(is_active=False)
            )
            await db.commit()
        logger.info("Deactivated %d invalid Expo push token(s)", len(tokens))
    except Exception as exc:
        logger.warning("Failed to deactivate invalid push tokens: %s", exc)


def _safe_json(resp: httpx.Response) -> dict[str, Any]:
    try:
        return resp.json()
    except ValueError:
        return {}


def get_push_service() -> Any:
    """Return the push module for use as a service handle."""
    # Functions are module-level, so we return the module itself.
    import sys
    return sys.modules[__name__]
