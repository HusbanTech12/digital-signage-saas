from datetime import datetime

from app.schemas.common import CamelModel


class OrganizationOut(CamelModel):
    id: str
    name: str
    slug: str
    created_at: datetime


class OrganizationUpdate(CamelModel):
    name: str | None = None
    slug: str | None = None
