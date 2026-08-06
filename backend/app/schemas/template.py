from datetime import datetime
from typing import Any

from app.schemas.common import CamelModel


class TemplateOut(CamelModel):
    id: str
    organization_id: str | None
    name: str
    description: str
    thumbnail_url: str | None
    is_global: bool
    canvas_json: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class TemplateCreate(CamelModel):
    organization_id: str
    name: str
    description: str | None = None


class TemplateUpdate(CamelModel):
    name: str | None = None
    description: str | None = None
    canvas_json: dict[str, Any] | None = None


class TemplateDuplicateIn(CamelModel):
    template_id: str
    organization_id: str
