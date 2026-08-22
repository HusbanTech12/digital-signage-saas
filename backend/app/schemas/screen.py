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
    created_at: datetime


class ScreenUpdate(CamelModel):
    name: str | None = None
    location_id: str | None = None
    orientation: ScreenOrientation | None = None
    resolution: str | None = None


class ScreenHeartbeatIn(CamelModel):
    device_token: str
