from datetime import datetime
from typing import Literal

from app.schemas.common import CamelModel

ScreenOrientation = Literal["landscape", "portrait"]
ScreenStatus = Literal["online", "offline", "pairing"]


class ScreenOut(CamelModel):
    id: str
    location_id: str | None
    organization_id: str
    name: str
    device_token: str
    pairing_code: str | None
    last_heartbeat: datetime | None
    resolution: str
    orientation: str
    status: str
    active_menu_id: str | None
    active_template_id: str | None
    active_playlist_id: str | None = None
    active_audio_playlist_id: str | None = None
    audio_volume: float = 0.5
    audio_muted: bool = False
    audio_loop: bool = True
    last_sync_at: datetime | None = None
    last_error: str | None = None
    last_error_at: datetime | None = None
    content_version: int | None = None
    content_updated_at: datetime | None = None
    current_content_summary: str | None = None
    client_app_version: str | None = None
    pending_command: str | None = None
    pending_command_id: str | None = None
    pending_command_at: datetime | None = None
    pairing_expires_at: datetime | None = None
    created_at: datetime


class ScreenUpdate(CamelModel):
    name: str | None = None
    location_id: str | None = None
    orientation: ScreenOrientation | None = None
    resolution: str | None = None
    active_audio_playlist_id: str | None = None
    audio_volume: float | None = None
    audio_muted: bool | None = None
    audio_loop: bool | None = None
    clear_audio_playlist: bool = False


class ScreenHeartbeatIn(CamelModel):
    device_token: str
    last_sync_at: datetime | None = None
    last_sync_error: str | None = None
    content_version: int | None = None
    content_updated_at: datetime | None = None
    current_content_summary: str | None = None
    client_app_version: str | None = None
    acked_command_id: str | None = None


class ScreenHeartbeatOut(ScreenOut):
    """Heartbeat response includes any pending remote command."""

    pass


class ScreenCommandOut(CamelModel):
    screen_id: str
    command: str
    command_id: str
    created_at: datetime
