"""Theme schedule evaluation + offline heartbeat sweeps (sync, Celery-safe)."""

from __future__ import annotations

import json
import logging
from datetime import datetime, time, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.services.realtime import CHANNEL_PREFIX, screen_channel
from db.models import Location, Menu, MenuItem, Screen, Template, Theme

logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _local_now(tz_name: str) -> datetime:
    try:
        tz = ZoneInfo(tz_name or "UTC")
    except ZoneInfoNotFoundError:
        tz = ZoneInfo("UTC")
    return datetime.now(tz)


def theme_is_active(theme: Theme, local_now: datetime) -> bool:
    if not theme.enabled:
        return False
    if theme.kind == "date_range":
        d = local_now.date()
        if theme.start_date is None and theme.end_date is None:
            return False
        if theme.start_date is not None and d < theme.start_date:
            return False
        if theme.end_date is not None and d > theme.end_date:
            return False
        return True
    if theme.kind == "time_of_day":
        if theme.start_time is None or theme.end_time is None:
            return False
        current = local_now.time().replace(second=0, microsecond=0)
        start = theme.start_time.replace(second=0, microsecond=0)
        end = theme.end_time.replace(second=0, microsecond=0)
        if start <= end:
            return start <= current < end
        # Overnight window (e.g. 22:00–06:00)
        return current >= start or current < end
    return False


def pick_theme_for_location(
    themes: list[Theme], location_id: str, local_now: datetime
) -> Theme | None:
    matching = [
        t
        for t in themes
        if location_id in (t.location_ids or []) and theme_is_active(t, local_now)
    ]
    if not matching:
        return None
    # Seasonal/date rules beat time-of-day; then newest created_at
    matching.sort(
        key=lambda t: (
            0 if t.kind == "date_range" else 1,
            -(t.created_at.timestamp() if t.created_at else 0),
        )
    )
    return matching[0]


def _build_display_payload_sync(db: Session, screen: Screen) -> dict | None:
    if screen.location_id is None or screen.status == "pairing":
        return None

    menu = db.get(Menu, screen.active_menu_id) if screen.active_menu_id else None
    template = (
        db.get(Template, screen.active_template_id)
        if screen.active_template_id
        else None
    )

    items: list[dict] = []
    if menu is not None:
        rows = db.scalars(
            select(MenuItem)
            .where(MenuItem.menu_id == menu.id, MenuItem.available.is_(True))
            .order_by(MenuItem.sort_order, MenuItem.name)
        ).all()
        for item in rows:
            price = float(item.price if isinstance(item.price, Decimal) else item.price)
            items.append(
                {
                    "id": item.id,
                    "menuId": item.menu_id,
                    "organizationId": item.organization_id,
                    "name": item.name,
                    "price": price,
                    "description": item.description or "",
                    "imageUrl": item.image_url,
                    "available": item.available,
                    "sortOrder": item.sort_order,
                    "category": item.category,
                    "createdAt": item.created_at.isoformat() if item.created_at else None,
                    "updatedAt": item.updated_at.isoformat() if item.updated_at else None,
                }
            )

    canvas = None
    if template is not None and isinstance(template.canvas_json, dict):
        canvas = template.canvas_json

    return {
        "screenId": screen.id,
        "screenName": screen.name,
        "organizationId": screen.organization_id,
        "orientation": screen.orientation,
        "resolution": screen.resolution,
        "menuId": menu.id if menu else None,
        "menuName": menu.name if menu else None,
        "menuVersion": menu.version if menu else None,
        "templateId": template.id if template else None,
        "templateName": template.name if template else None,
        "canvasJson": canvas,
        "items": items,
        "updatedAt": _utcnow().isoformat(),
        "playlist": None,
    }


def _publish_events_redis(events: list[dict]) -> bool:
    if not events:
        return True
    settings = get_settings()
    try:
        import redis

        client = redis.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=0.4,
            socket_timeout=0.4,
        )
        try:
            client.ping()
            pipe = client.pipeline()
            for event in events:
                screen_id = event.get("screenId")
                if not isinstance(screen_id, str):
                    continue
                pipe.publish(screen_channel(screen_id), json.dumps(event))
            pipe.execute()
            return True
        finally:
            client.close()
    except Exception as exc:  # noqa: BLE001
        logger.warning("Redis theme fan-out failed: %s", exc)
        return False


def mark_stale_screens_offline(db: Session) -> int:
    settings = get_settings()
    cutoff = _utcnow().timestamp() - settings.screen_offline_after_seconds
    cutoff_dt = datetime.fromtimestamp(cutoff, tz=timezone.utc)
    screens = db.scalars(
        select(Screen).where(
            Screen.status == "online",
            Screen.location_id.is_not(None),
        )
    ).all()
    changed = 0
    for screen in screens:
        last = screen.last_heartbeat
        if last is None or last < cutoff_dt:
            screen.status = "offline"
            changed += 1
    if changed:
        db.commit()
    return changed


def apply_due_themes(db: Session) -> list[dict]:
    """
    Evaluate enabled themes per location timezone and update screen active menu/template.
    Returns realtime event dicts ({type, screenId, payload, ts}) for fan-out.
    """
    locations = db.scalars(select(Location)).all()
    themes = db.scalars(select(Theme).where(Theme.enabled.is_(True))).all()
    events: list[dict] = []
    dirty = False

    for location in locations:
        local_now = _local_now(location.timezone)
        winner = pick_theme_for_location(list(themes), location.id, local_now)
        if winner is None:
            continue

        screens = db.scalars(
            select(Screen).where(
                Screen.location_id == location.id,
                Screen.status != "pairing",
            )
        ).all()
        for screen in screens:
            desired_audio = winner.audio_playlist_id
            if (
                screen.active_menu_id == winner.menu_id
                and screen.active_template_id == winner.template_id
                and screen.active_playlist_id is None
                and screen.active_audio_playlist_id == desired_audio
            ):
                continue
            screen.active_menu_id = winner.menu_id
            screen.active_template_id = winner.template_id
            screen.active_playlist_id = None
            # Only change background audio when the theme specifies a playlist.
            if desired_audio is not None:
                screen.active_audio_playlist_id = desired_audio
            dirty = True
            payload = _build_display_payload_sync(db, screen)
            if payload is None:
                continue
            events.append(
                {
                    "type": "menu.published",
                    "screenId": screen.id,
                    "payload": payload,
                    "ts": _utcnow().isoformat(),
                }
            )

    if dirty:
        db.commit()
    return events


def run_scheduler_tick() -> tuple[list[dict], bool, dict[str, int]]:
    """
    Offline sweep + theme apply.
    Returns (events, published_via_redis, stats).
    """
    from db.sync_session import SyncSessionLocal

    with SyncSessionLocal() as db:
        offline = mark_stale_screens_offline(db)
        events = apply_due_themes(db)
        via_redis = _publish_events_redis(events) if events else True
        stats = {
            "offline_marked": offline,
            "theme_events": len(events),
            "channel_prefix": CHANNEL_PREFIX,
        }
        return events, via_redis, stats
