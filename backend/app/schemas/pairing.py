from datetime import datetime
from typing import Literal

from app.schemas.common import CamelModel
from app.schemas.screen import ScreenOut


class PendingPairingOut(CamelModel):
    code: str
    screen_id: str
    created_at: datetime
    expires_at: datetime


class PairingSessionCreate(CamelModel):
    organization_id: str
    resolution: str = "1920x1080"
    orientation: Literal["landscape", "portrait"] = "landscape"


class PairingSessionOut(CamelModel):
    screen: ScreenOut
    pairing: PendingPairingOut


class PairingCompleteIn(CamelModel):
    code: str
    location_id: str
    name: str
    organization_id: str
    resolution: str | None = None
    orientation: Literal["landscape", "portrait"] | None = None
