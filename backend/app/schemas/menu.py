from datetime import datetime
from decimal import Decimal

from pydantic import Field, field_validator

from app.schemas.common import CamelModel


class MenuOut(CamelModel):
    id: str
    organization_id: str
    name: str
    version: int
    status: str = "draft"
    published_at: datetime | None
    published_by_user_id: str | None = None
    created_at: datetime
    updated_at: datetime


class MenuCreate(CamelModel):
    organization_id: str
    name: str


class MenuUpdate(CamelModel):
    name: str | None = None
    status: str | None = None


class MenuItemOut(CamelModel):
    id: str
    menu_id: str
    organization_id: str
    name: str
    price: float
    description: str
    image_url: str | None
    available: bool
    sort_order: int
    category: str
    created_at: datetime
    updated_at: datetime

    @field_validator("price", mode="before")
    @classmethod
    def _price_to_float(cls, value: object) -> float:
        if isinstance(value, Decimal):
            return float(value)
        return float(value)  # type: ignore[arg-type]


class MenuItemCreate(CamelModel):
    menu_id: str
    organization_id: str
    name: str
    price: float
    description: str | None = None
    category: str | None = None
    available: bool | None = True


class MenuItemUpdate(CamelModel):
    name: str | None = None
    price: float | None = None
    description: str | None = None
    category: str | None = None
    available: bool | None = None
    sort_order: int | None = None


class PublishMenuIn(CamelModel):
    menu_id: str
    template_id: str
    screen_ids: list[str] = Field(default_factory=list)
    change_summary: str | None = None
