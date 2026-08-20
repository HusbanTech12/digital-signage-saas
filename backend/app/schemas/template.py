from datetime import datetime
from typing import Any, Literal

from pydantic import Field, field_validator

from app.schemas.common import CamelModel

ScreenOrientation = Literal["landscape", "portrait"]


class TemplateOut(CamelModel):
    id: str
    organization_id: str | None
    name: str
    description: str
    thumbnail_url: str | None
    is_global: bool
    canvas_json: dict[str, Any]
    display_config: dict[str, Any] = Field(default_factory=dict)
    resolution: str = "1920x1080"
    orientation: ScreenOrientation = "landscape"
    created_at: datetime
    updated_at: datetime

    @field_validator("display_config", mode="before")
    @classmethod
    def coerce_display_config(cls, value: object) -> dict[str, Any]:
        return value if isinstance(value, dict) else {}

    @field_validator("resolution", mode="before")
    @classmethod
    def coerce_resolution(cls, value: object) -> str:
        if isinstance(value, str) and value.strip():
            return value.strip()
        return "1920x1080"

    @field_validator("orientation", mode="before")
    @classmethod
    def coerce_orientation(cls, value: object) -> str:
        if value in ("landscape", "portrait"):
            return value
        return "landscape"


class TemplateCreate(CamelModel):
    organization_id: str
    name: str
    description: str | None = None
    resolution: str | None = None
    orientation: ScreenOrientation | None = None


class TemplateUpdate(CamelModel):
    name: str | None = None
    description: str | None = None
    canvas_json: dict[str, Any] | None = None
    display_config: dict[str, Any] | None = None
    resolution: str | None = None
    orientation: ScreenOrientation | None = None


class TemplateDuplicateIn(CamelModel):
    template_id: str
    organization_id: str
