from datetime import datetime

from app.schemas.common import CamelModel


class LocationOut(CamelModel):
    id: str
    organization_id: str
    name: str
    address: str
    timezone: str
    created_at: datetime


class LocationCreate(CamelModel):
    organization_id: str
    name: str
    address: str
    timezone: str = "UTC"


class LocationUpdate(CamelModel):
    name: str | None = None
    address: str | None = None
    timezone: str | None = None
