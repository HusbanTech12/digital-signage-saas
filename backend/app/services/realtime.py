"""Redis pub/sub fan-out for screen-scoped WebSocket events.

When Redis is unavailable (common in local dev without Docker), falls back to
an in-process connection hub so single-worker uvicorn still pushes updates.
"""

from __future__ import annotations

import asyncio
import json
import logging
from collections import defaultdict
from typing import Any

from fastapi import WebSocket
from redis.asyncio import Redis

from app.config import get_settings
from app.schemas.display import RealtimeEvent

logger = logging.getLogger(__name__)

CHANNEL_PREFIX = "signage:screen:"


def screen_channel(screen_id: str) -> str:
    return f"{CHANNEL_PREFIX}{screen_id}"


class RealtimeHub:
    def __init__(self) -> None:
        self._local: dict[str, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()
        self._redis: Redis | None = None
        self._relay_task: asyncio.Task[None] | None = None
        self._running = False

    @property
    def redis_enabled(self) -> bool:
        return self._redis is not None

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        settings = get_settings()
        try:
            client = Redis.from_url(
                settings.redis_url,
                decode_responses=True,
                socket_connect_timeout=2,
            )
            await client.ping()
            self._redis = client
            self._relay_task = asyncio.create_task(
                self._relay_loop(), name="realtime-redis-relay"
            )
            logger.info("Realtime hub connected to Redis at %s", settings.redis_url)
        except Exception as exc:  # noqa: BLE001 — degrade to local fan-out
            self._redis = None
            logger.warning(
                "Realtime hub running without Redis (%s). "
                "In-process WebSocket fan-out only.",
                exc,
            )

    async def stop(self) -> None:
        self._running = False
        if self._relay_task is not None:
            self._relay_task.cancel()
            try:
                await self._relay_task
            except asyncio.CancelledError:
                pass
            self._relay_task = None
        if self._redis is not None:
            await self._redis.aclose()
            self._redis = None
        async with self._lock:
            self._local.clear()

    async def register(self, screen_id: str, websocket: WebSocket) -> None:
        async with self._lock:
            self._local[screen_id].add(websocket)

    async def unregister(self, screen_id: str, websocket: WebSocket) -> None:
        async with self._lock:
            conns = self._local.get(screen_id)
            if not conns:
                return
            conns.discard(websocket)
            if not conns:
                self._local.pop(screen_id, None)

    async def publish_event(self, event: RealtimeEvent) -> None:
        data = event.model_dump(by_alias=True, mode="json")
        payload = json.dumps(data)

        if self._redis is not None:
            try:
                await self._redis.publish(screen_channel(event.screen_id), payload)
                return
            except Exception as exc:  # noqa: BLE001
                logger.warning("Redis publish failed; using local fan-out: %s", exc)

        await self._broadcast_local(event.screen_id, data)

    async def _broadcast_local(self, screen_id: str, data: dict[str, Any]) -> None:
        async with self._lock:
            targets = list(self._local.get(screen_id, ()))
        if not targets:
            return
        dead: list[WebSocket] = []
        for ws in targets:
            try:
                await ws.send_json(data)
            except Exception:  # noqa: BLE001
                dead.append(ws)
        for ws in dead:
            await self.unregister(screen_id, ws)

    async def _relay_loop(self) -> None:
        assert self._redis is not None
        pubsub = self._redis.pubsub()
        try:
            await pubsub.psubscribe(f"{CHANNEL_PREFIX}*")
            while self._running:
                message = await pubsub.get_message(
                    ignore_subscribe_messages=True, timeout=1.0
                )
                if message is None:
                    await asyncio.sleep(0.01)
                    continue
                if message.get("type") not in ("pmessage", "message"):
                    continue
                channel = message.get("channel") or ""
                if not isinstance(channel, str) or not channel.startswith(
                    CHANNEL_PREFIX
                ):
                    continue
                screen_id = channel.removeprefix(CHANNEL_PREFIX)
                raw = message.get("data")
                if not isinstance(raw, str):
                    continue
                try:
                    data = json.loads(raw)
                except json.JSONDecodeError:
                    continue
                if isinstance(data, dict):
                    await self._broadcast_local(screen_id, data)
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # noqa: BLE001
            logger.exception("Realtime Redis relay stopped: %s", exc)
        finally:
            try:
                await pubsub.punsubscribe(f"{CHANNEL_PREFIX}*")
                await pubsub.aclose()
            except Exception:  # noqa: BLE001
                pass


_hub = RealtimeHub()


def get_realtime_hub() -> RealtimeHub:
    return _hub
