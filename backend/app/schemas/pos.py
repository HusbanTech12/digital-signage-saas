from datetime import datetime
from typing import Any, Literal

from pydantic import Field

from app.schemas.common import CamelModel

PosProvider = Literal["clover", "clear_mock"]
PosIntegrationStatus = Literal["inactive", "active", "error"]
PosEventStatus = Literal["received", "processing", "applied", "failed"]


class PosIntegrationOut(CamelModel):
    id: str
    location_id: str
    organization_id: str
    provider: str
    status: str
    config: dict[str, Any]
    has_credentials: bool = False
    oauth_connected: bool = False
    merchant_id: str | None = None
    last_sync_at: datetime | None = None
    last_error: str | None = None
    created_at: datetime


class PosIntegrationCreate(CamelModel):
    organization_id: str
    location_id: str
    provider: PosProvider = "clover"
    credentials: dict[str, Any] = Field(default_factory=dict)
    config: dict[str, Any] = Field(default_factory=dict)
    status: PosIntegrationStatus = "active"


class PosIntegrationUpdate(CamelModel):
    credentials: dict[str, Any] | None = None
    config: dict[str, Any] | None = None
    status: PosIntegrationStatus | None = None


class PosSyncEventOut(CamelModel):
    id: str
    integration_id: str
    organization_id: str
    event_type: str
    payload: dict[str, Any]
    status: str
    error_message: str | None
    created_at: datetime


class PosSyncStatusOut(CamelModel):
    organization_id: str
    integrations_active: int
    integrations_error: int
    last_sync_at: datetime | None
    last_event_status: str | None
    recent_failures: int


class PosSimulateIn(CamelModel):
    updates: list[dict[str, Any]]


class PosWebhookAccepted(CamelModel):
    accepted: bool = True
    event_id: str
    queued: bool = False
    inline: bool = False


class PosCatalogItemOut(CamelModel):
    external_sku: str
    name: str
    price: float | None = None
    available: bool | None = None
    external_id: str | None = None


class PosCatalogOut(CamelModel):
    items: list[PosCatalogItemOut]
    oauth_connected: bool = False


class PosOAuthStartOut(CamelModel):
    authorize_url: str
    provider: str


class PosCloverVerificationOut(CamelModel):
    verification_code: str | None = None

