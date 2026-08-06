from datetime import datetime
from typing import Any

from app.schemas.common import CamelModel
from app.schemas.menu import MenuItemOut


class DisplayPayloadOut(CamelModel):
    """Kiosk snapshot — matches frontend DisplayPayload (camelCase)."""

    screen_id: str
    screen_name: str
    organization_id: str
    orientation: str
    resolution: str
    menu_id: str | None
    menu_name: str | None
    menu_version: int | None
    template_id: str | None
    template_name: str | None
    canvas_json: dict[str, Any] | None
    items: list[MenuItemOut]
    updated_at: datetime


class RealtimeEvent(CamelModel):
    """AGENTS.md Section 9 envelope: { type, screenId, payload, ts }."""

    type: str
    screen_id: str
    payload: dict[str, Any]
    ts: datetime
