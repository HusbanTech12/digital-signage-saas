from datetime import datetime
from typing import Any, Literal

from app.schemas.common import CamelModel

EntityType = Literal["menu", "template", "playlist"]


class ContentVersionOut(CamelModel):
    id: str
    organization_id: str
    entity_type: str
    entity_id: str
    version: int
    status: str
    change_summary: str | None
    published_by_user_id: str | None
    created_at: datetime
    # Omitted in list responses for payload size; included on detail.
    snapshot: dict[str, Any] | None = None


class ContentVersionListOut(CamelModel):
    versions: list[ContentVersionOut]
    total: int


class RestoreVersionOut(CamelModel):
    entity_type: str
    entity_id: str
    restored_version: int


class PublishTemplateIn(CamelModel):
    change_summary: str | None = None
