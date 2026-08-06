"""Apply normalized POS events to menu_items + fan-out screens."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.services.display_content import build_display_payload
from app.services.pos.base import get_adapter
from app.services.pos.events import (
    AvailabilityUpdateEvent,
    PriceUpdateEvent,
    event_to_dict,
)
from app.services.realtime import get_realtime_hub
from app.schemas.display import RealtimeEvent
from app.services.theme_scheduler import _build_display_payload_sync, _publish_events_redis
from app.utils.ids import new_id
from db.models import Menu, MenuItem, PosIntegration, PosSyncEvent, Screen

logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _item_map(integration: PosIntegration) -> dict[str, str]:
    config = integration.config if isinstance(integration.config, dict) else {}
    raw = config.get("itemMap") or config.get("item_map") or {}
    if not isinstance(raw, dict):
        return {}
    return {str(k): str(v) for k, v in raw.items()}


def enqueue_pos_raw_event(
    db: Session,
    *,
    integration: PosIntegration,
    raw_payload: dict,
    event_type: str = "webhook_raw",
) -> PosSyncEvent:
    row = PosSyncEvent(
        id=new_id("pse"),
        integration_id=integration.id,
        organization_id=integration.organization_id,
        event_type=event_type,
        payload={"raw": raw_payload},
        status="received",
        error_message=None,
        created_at=_utcnow(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


async def enqueue_pos_raw_event_async(
    db: AsyncSession,
    *,
    integration: PosIntegration,
    raw_payload: dict,
    event_type: str = "webhook_raw",
) -> PosSyncEvent:
    row = PosSyncEvent(
        id=new_id("pse"),
        integration_id=integration.id,
        organization_id=integration.organization_id,
        event_type=event_type,
        payload={"raw": raw_payload},
        status="received",
        error_message=None,
        created_at=_utcnow(),
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


def process_pos_sync_event(db: Session, event_id: str) -> dict:
    event = db.get(PosSyncEvent, event_id)
    if event is None:
        return {"ok": False, "error": "event not found"}

    integration = db.get(PosIntegration, event.integration_id)
    if integration is None:
        event.status = "failed"
        event.error_message = "Integration missing"
        db.commit()
        return {"ok": False, "error": "integration missing"}

    event.status = "processing"
    db.commit()

    try:
        adapter = get_adapter(integration.provider)
        raw = event.payload.get("raw") if isinstance(event.payload, dict) else {}
        if not isinstance(raw, dict):
            raw = {}
        normalized = adapter.parse_webhook(raw)
        item_map = _item_map(integration)
        touched_menu_ids: set[str] = set()
        applied: list[dict] = []

        for update in normalized:
            sku = update.external_sku
            menu_item_id = item_map.get(sku) or update.menu_item_id
            if not menu_item_id:
                raise ValueError(f"No itemMap entry for SKU {sku}")

            item = db.get(MenuItem, menu_item_id)
            if item is None or item.organization_id != integration.organization_id:
                raise ValueError(f"Menu item not found for SKU {sku}")

            if isinstance(update, PriceUpdateEvent):
                item.price = Decimal(str(round(float(update.price), 2)))
                update.menu_item_id = item.id
            elif isinstance(update, AvailabilityUpdateEvent):
                item.available = bool(update.available)
                update.menu_item_id = item.id

            item.updated_at = _utcnow()
            menu = db.get(Menu, item.menu_id)
            if menu:
                menu.updated_at = item.updated_at
            touched_menu_ids.add(item.menu_id)
            applied.append(event_to_dict(update))

        realtime_events: list[dict] = []
        if touched_menu_ids:
            screens = db.scalars(
                select(Screen).where(
                    Screen.organization_id == integration.organization_id,
                    Screen.active_menu_id.in_(touched_menu_ids),
                    Screen.status != "pairing",
                )
            ).all()
            for screen in screens:
                payload = _build_display_payload_sync(db, screen)
                if payload is None:
                    continue
                realtime_events.append(
                    {
                        "type": "menu.published",
                        "screenId": screen.id,
                        "payload": payload,
                        "ts": _utcnow().isoformat(),
                    }
                )

        event.status = "applied"
        event.error_message = None
        event.payload = {
            "raw": raw,
            "applied": applied,
            "screensNotified": len(realtime_events),
        }
        if integration.status == "error":
            integration.status = "active"
        db.commit()

        via_redis = _publish_events_redis(realtime_events) if realtime_events else True
        return {
            "ok": True,
            "applied": len(applied),
            "screensNotified": len(realtime_events),
            "publishedViaRedis": via_redis,
            "realtimeEvents": realtime_events,
        }
    except Exception as exc:  # noqa: BLE001
        logger.exception("POS sync failed for %s", event_id)
        event.status = "failed"
        event.error_message = str(exc)
        integration.status = "error"
        db.commit()
        return {"ok": False, "error": str(exc)}


async def process_pos_sync_event_async(db: AsyncSession, event_id: str) -> dict:
    event = await db.get(PosSyncEvent, event_id)
    if event is None:
        return {"ok": False, "error": "event not found"}

    integration = await db.get(PosIntegration, event.integration_id)
    if integration is None:
        event.status = "failed"
        event.error_message = "Integration missing"
        await db.commit()
        return {"ok": False, "error": "integration missing"}

    event.status = "processing"
    await db.commit()

    try:
        adapter = get_adapter(integration.provider)
        raw = event.payload.get("raw") if isinstance(event.payload, dict) else {}
        if not isinstance(raw, dict):
            raw = {}
        normalized = adapter.parse_webhook(raw)
        item_map = _item_map(integration)
        touched_menu_ids: set[str] = set()
        applied: list[dict] = []

        for update in normalized:
            sku = update.external_sku
            menu_item_id = item_map.get(sku) or update.menu_item_id
            if not menu_item_id:
                raise ValueError(f"No itemMap entry for SKU {sku}")

            item = await db.get(MenuItem, menu_item_id)
            if item is None or item.organization_id != integration.organization_id:
                raise ValueError(f"Menu item not found for SKU {sku}")

            if isinstance(update, PriceUpdateEvent):
                item.price = Decimal(str(round(float(update.price), 2)))
                update.menu_item_id = item.id
            elif isinstance(update, AvailabilityUpdateEvent):
                item.available = bool(update.available)
                update.menu_item_id = item.id

            item.updated_at = _utcnow()
            menu = await db.get(Menu, item.menu_id)
            if menu:
                menu.updated_at = item.updated_at
            touched_menu_ids.add(item.menu_id)
            applied.append(event_to_dict(update))

        realtime_events: list[dict] = []
        if touched_menu_ids:
            result = await db.execute(
                select(Screen).where(
                    Screen.organization_id == integration.organization_id,
                    Screen.active_menu_id.in_(list(touched_menu_ids)),
                    Screen.status != "pairing",
                )
            )
            for screen in result.scalars().all():
                payload = await build_display_payload(db, screen)
                if payload is None:
                    continue
                realtime_events.append(
                    {
                        "type": "menu.published",
                        "screenId": screen.id,
                        "payload": payload.model_dump(by_alias=True, mode="json"),
                        "ts": _utcnow().isoformat(),
                    }
                )

        event.status = "applied"
        event.error_message = None
        event.payload = {
            "raw": raw,
            "applied": applied,
            "screensNotified": len(realtime_events),
        }
        if integration.status == "error":
            integration.status = "active"
        await db.commit()

        via_redis = _publish_events_redis(realtime_events) if realtime_events else True
        if realtime_events and not via_redis:
            hub = get_realtime_hub()
            for raw_event in realtime_events:
                try:
                    await hub.publish_event(RealtimeEvent.model_validate(raw_event))
                except Exception:  # noqa: BLE001
                    logger.debug("POS local fan-out skipped", exc_info=True)

        return {
            "ok": True,
            "applied": len(applied),
            "screensNotified": len(realtime_events),
            "publishedViaRedis": via_redis,
        }
    except Exception as exc:  # noqa: BLE001
        logger.exception("POS sync failed for %s", event_id)
        event.status = "failed"
        event.error_message = str(exc)
        integration.status = "error"
        await db.commit()
        return {"ok": False, "error": str(exc)}


def dispatch_pos_event(event_id: str) -> dict[str, Any]:
    """Try Celery; caller should fall back to async inline on failure."""
    try:
        from workers.tasks import process_pos_webhook_task

        async_result = process_pos_webhook_task.delay(event_id)
        return {"queued": True, "taskId": async_result.id, "eventId": event_id}
    except Exception as exc:  # noqa: BLE001
        logger.warning("Celery unavailable for POS event %s: %s", event_id, exc)
        return {"queued": False, "eventId": event_id, "celeryError": str(exc)}
