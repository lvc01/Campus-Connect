"""
WebSocket connection manager — tracks active connections per user and
provides broadcast (conversation-level) and unicast (user-level) send
using Redis Pub/Sub for cross-worker communication.
"""

import asyncio
import json
import logging
from fastapi import WebSocket
import redis.asyncio as redis

from app.config import get_settings

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Maps user_id → set of WebSocket connections on the local worker.
    Uses Redis Pub/Sub to forward messages to users connected to other workers.
    If Redis is unavailable, falls back to local-only delivery (single-worker dev).
    """

    def __init__(self) -> None:
        self._user_connections: dict[str, set[WebSocket]] = {}
        self.settings = get_settings()
        self.redis: redis.Redis | None = None
        self.pubsub: redis.client.PubSub | None = None
        self._listen_task: asyncio.Task | None = None

    async def connect_redis(self) -> None:
        """Initialize Redis connection and start listening to PubSub.

        If Redis is disabled (REDIS_ENABLED=false) or unreachable, logs a
        warning and falls back to local-only delivery. Never raises.
        """
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
        """Close Redis connection."""
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
            logger.error(f"Redis PubSub listen error: {e}", exc_info=True)

    async def connect(self, user_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._user_connections.setdefault(user_id, set()).add(websocket)
        logger.info("WS connect: user=%s total_connections=%s", user_id, self._count())

    async def disconnect(self, user_id: str, websocket: WebSocket) -> None:
        user_conns = self._user_connections.get(user_id, set())
        user_conns.discard(websocket)
        if not user_conns:
            self._user_connections.pop(user_id, None)
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

    def is_online(self, user_id: str) -> bool:
        # Note: This only checks local online status. A true global online status
        # would require tracking presence in Redis (e.g. setting a key with TTL).
        return user_id in self._user_connections and bool(self._user_connections[user_id])

    def _count(self) -> int:
        return sum(len(v) for v in self._user_connections.values())


manager = ConnectionManager()
