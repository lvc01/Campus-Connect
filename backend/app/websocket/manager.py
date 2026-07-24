"""
WebSocket connection manager — tracks active connections per user and
provides broadcast (conversation-level) and unicast (user-level) send
using Redis Pub/Sub for cross-worker communication.

Presence is tracked in Redis with a per-user TTL key so that
``is_online_async()`` works correctly across multiple gunicorn workers.
"""

import asyncio
import json
import logging
from fastapi import WebSocket
import redis.asyncio as redis

from app.config import get_settings

logger = logging.getLogger(__name__)

_PRESENCE_TTL_SECONDS = 60
_PRESENCE_REFRESH_SECONDS = 30


class ConnectionManager:
    """
    Maps user_id → set of WebSocket connections on the local worker.
    Uses Redis Pub/Sub to forward messages to users connected to other workers.
    Uses Redis presence keys with TTL for cross-worker online status.
    If Redis is unavailable, falls back to local-only delivery (single-worker dev).
    """

    def __init__(self) -> None:
        self._user_connections: dict[str, set[WebSocket]] = {}
        self._presence_tasks: dict[str, asyncio.Task] = {}
        self.settings = get_settings()
        self.redis: redis.Redis | None = None
        self.pubsub: redis.client.PubSub | None = None
        self._listen_task: asyncio.Task | None = None

    async def connect_redis(self) -> None:
        """Initialize Redis connection and start listening to PubSub."""
        if self.redis is not None or not self.settings.REDIS_ENABLED:
            return
        try:
            client = redis.from_url(
                self.settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=2,
                socket_timeout=None,
            )
            await client.ping()
            self.redis = client
            self.pubsub = self.redis.pubsub()
            await self.pubsub.subscribe("ws_messages")
            self._listen_task = asyncio.create_task(self._listen_to_redis())
            logger.info("Redis pub/sub connected at %s", self.settings.REDIS_URL)
        except Exception as e:
            logger.warning(
                "Redis unavailable (%s) — running in single-worker mode (no cross-worker broadcast).",
                e,
            )
            self.redis = None
            self.pubsub = None
            self._listen_task = None

    async def disconnect_redis(self) -> None:
        """Close Redis connection and cancel all presence refresh tasks."""
        for task in self._presence_tasks.values():
            task.cancel()
        self._presence_tasks.clear()

        if self._listen_task:
            self._listen_task.cancel()
            try:
                await self._listen_task
            except (asyncio.CancelledError, Exception):
                pass
        if self.pubsub:
            try:
                await self.pubsub.close()
            except Exception:
                pass
        if self.redis:
            try:
                await self.redis.close()
            except Exception:
                pass

    async def _listen_to_redis(self) -> None:
        """Background task to listen for messages from other workers."""
        try:
            async for message in self.pubsub.listen():
                if message["type"] == "message":
                    data = json.loads(message["data"])
                    target_user_id = data.get("target_user_id")
                    payload = data.get("payload")

                    if target_user_id and payload:
                        await self._send_to_local_user(target_user_id, payload)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error("Redis PubSub listen error: %s", e, exc_info=True)

    async def _refresh_presence(self, user_id: str) -> None:
        """Periodically refresh the Redis presence key TTL for a user."""
        try:
            while True:
                await asyncio.sleep(_PRESENCE_REFRESH_SECONDS)
                if self.redis is None:
                    break
                # Only refresh if user still has local connections
                if user_id not in self._user_connections or not self._user_connections[user_id]:
                    break
                try:
                    await self.redis.set(
                        f"ws:online:{user_id}",
                        "1",
                        ex=_PRESENCE_TTL_SECONDS,
                    )
                except Exception:
                    logger.debug("Failed to refresh presence for user %s", user_id)
                    break
        except asyncio.CancelledError:
            pass

    async def connect(self, user_id: str, websocket: WebSocket, subprotocol: str | None = None) -> None:
        await websocket.accept(subprotocol=subprotocol)
        self._user_connections.setdefault(user_id, set()).add(websocket)
        logger.info("WS connect: user=%s total_connections=%s", user_id, self._count())

        # Set/cross-worker presence key in Redis with TTL
        if self.redis:
            try:
                await self.redis.set(
                    f"ws:online:{user_id}",
                    "1",
                    ex=_PRESENCE_TTL_SECONDS,
                )
                if user_id not in self._presence_tasks or self._presence_tasks[user_id].done():
                    self._presence_tasks[user_id] = asyncio.create_task(
                        self._refresh_presence(user_id)
                    )
            except Exception:
                logger.debug("Failed to set presence for user %s", user_id)

    async def disconnect(self, user_id: str, websocket: WebSocket) -> None:
        user_conns = self._user_connections.get(user_id, set())
        user_conns.discard(websocket)
        if not user_conns:
            self._user_connections.pop(user_id, None)
            # Cancel presence refresh and clear Redis key
            if user_id in self._presence_tasks:
                self._presence_tasks.pop(user_id).cancel()
            if self.redis:
                try:
                    await self.redis.delete(f"ws:online:{user_id}")
                except Exception:
                    pass
        logger.info("WS disconnect: user=%s total_connections=%s", user_id, self._count())

    async def _send_to_local_user(self, user_id: str, message: dict) -> None:
        """Send a message only to connections on this specific worker."""
        payload = json.dumps(message)
        for ws in self._user_connections.get(user_id, set()):
            try:
                await ws.send_text(payload)
            except Exception:
                pass

    async def send_to_user(self, user_id: str, message: dict) -> None:
        """Send a JSON message to a user, regardless of which worker they are on."""
        # We publish to Redis, which will then trigger _send_to_local_user on all workers
        if self.redis:
            await self.redis.publish("ws_messages", json.dumps({
                "target_user_id": user_id,
                "payload": message
            }))
        else:
            await self._send_to_local_user(user_id, message)

    async def send_to_conversation(
        self,
        conversation_id: str,
        message: dict,
        exclude_user_id: str | None = None,
        member_user_ids: list[str] | None = None,
    ) -> None:
        """Broadcast to all conversation members, optionally excluding the sender."""
        if not member_user_ids:
            return
        
        for uid in member_user_ids:
            if exclude_user_id and uid == exclude_user_id:
                continue
            await self.send_to_user(uid, message)

    async def is_online_async(self, user_id: str) -> bool:
        """Async version that checks Redis for cross-worker presence."""
        if user_id in self._user_connections and self._user_connections[user_id]:
            return True
        if self.redis is None:
            return False
        try:
            return await self.redis.exists(f"ws:online:{user_id}") > 0
        except Exception:
            return False

    def _count(self) -> int:
        return sum(len(v) for v in self._user_connections.values())


manager = ConnectionManager()
