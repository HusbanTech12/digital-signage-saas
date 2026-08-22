from datetime import datetime
from typing import Any

from app.schemas.common import CamelModel
from app.schemas.menu import MenuItemOut
from app.schemas.playlist import PlaylistPlaybackOut


class WallInfoOut(CamelModel):
    """Tile + sync metadata when the screen belongs to a video wall."""

    group_id: str
    group_name: str
    layout: str
    rows: int
    cols: int
    row: int
    col: int
    content_mode: str
    sync_epoch_ms: int | None = None
    bezel_compensation_pct: float = 0.0


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
    display_config: dict[str, Any] | None = None
    items: list[MenuItemOut]
    updated_at: datetime
    playlist: PlaylistPlaybackOut | None = None
    wall: WallInfoOut | None = None


class RealtimeEvent(CamelModel):
    """AGENTS.md Section 9 envelope: { type, screenId, payload, ts }."""

    type: str
    screen_id: str
    payload: dict[str, Any]
    ts: datetime
