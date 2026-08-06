import asyncio
import logging

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from app.schemas.display import RealtimeEvent
from app.services.display_content import build_display_payload
from app.services.pairing import utcnow
from app.services.realtime import get_realtime_hub
from db.models import Screen
from db.session import AsyncSessionLocal

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/screens", tags=["realtime"])


@router.websocket("/{screen_id}/ws")
async def screen_realtime_ws(
    websocket: WebSocket,
    screen_id: str,
    device_token: str = Query(..., alias="device_token"),
) -> None:
    """
    Per-screen WebSocket channel. Auth = long-lived device_token.
    On connect, sends current content as menu.published (if available).
    """
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Screen).where(
                Screen.id == screen_id,
                Screen.device_token == device_token,
            )
        )
        screen = result.scalar_one_or_none()
        if screen is None:
            await websocket.close(code=1008)
            return
        initial_payload = None
        built = await build_display_payload(db, screen)
        if built is not None:
            initial_payload = built.model_dump(by_alias=True, mode="json")

    await websocket.accept()
    hub = get_realtime_hub()
    await hub.register(screen_id, websocket)

    if initial_payload is not None:
        event = RealtimeEvent(
            type="menu.published",
            screen_id=screen_id,
            payload=initial_payload,
            ts=utcnow(),
        )
        try:
            await websocket.send_json(event.model_dump(by_alias=True, mode="json"))
        except Exception:  # noqa: BLE001
            await hub.unregister(screen_id, websocket)
            return

    try:
        while True:
            # Keepalive / ignore client pings; server pushes are outbound-only.
            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
            except asyncio.TimeoutError:
                try:
                    await websocket.send_json({"type": "ping", "screenId": screen_id})
                except Exception:  # noqa: BLE001
                    break
    except WebSocketDisconnect:
        pass
    except Exception as exc:  # noqa: BLE001
        logger.debug("WebSocket closed for %s: %s", screen_id, exc)
    finally:
        await hub.unregister(screen_id, websocket)
