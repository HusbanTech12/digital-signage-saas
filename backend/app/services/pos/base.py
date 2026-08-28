"""POS adapter interface — one contract, provider-specific auth/catalog/webhooks."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from app.services.pos.catalog import CatalogItem
from app.services.pos.events import PosEvent


class POSAdapter(ABC):
    provider: str
    supports_oauth: bool = False

    @abstractmethod
    def parse_webhook(self, payload: dict[str, Any]) -> list[PosEvent]:
        """Normalize provider webhook JSON into Price/Availability events."""

    def verify_webhook(
        self,
        *,
        credentials: dict[str, Any],
        authorization: str | None,
        x_pos_signature: str | None,
        x_clover_auth: str | None,
    ) -> None:
        """Raise HTTPException if a configured secret does not match."""
        from fastapi import HTTPException

        secret = credentials.get("webhookSecret") or credentials.get("webhook_secret")
        if not secret:
            return
        token = None
        if authorization and authorization.lower().startswith("bearer "):
            token = authorization.split(" ", 1)[1].strip()
        if x_pos_signature:
            token = x_pos_signature.strip()
        if x_clover_auth:
            token = x_clover_auth.strip()
        if token != str(secret):
            raise HTTPException(status_code=401, detail="Invalid POS webhook secret")

    def resolve_events_sync(
        self,
        payload: dict[str, Any],
        credentials: dict[str, Any],
        config: dict[str, Any],
    ) -> list[PosEvent]:
        return self.parse_webhook(payload)

    async def resolve_events(
        self,
        payload: dict[str, Any],
        credentials: dict[str, Any],
        config: dict[str, Any],
    ) -> list[PosEvent]:
        return self.parse_webhook(payload)

    async def fetch_catalog(
        self,
        credentials: dict[str, Any],
        config: dict[str, Any],
    ) -> list[CatalogItem]:
        return []

    def authorize_url(self, *, redirect_uri: str, state: str) -> str:
        raise ValueError(f"{self.provider} does not use OAuth")

    async def exchange_code(
        self,
        *,
        code: str,
        merchant_id: str | None,
    ) -> dict[str, Any]:
        raise ValueError(f"{self.provider} does not use OAuth")


def get_adapter(provider: str) -> POSAdapter:
    from app.services.pos.clear_mock import ClearMockAdapter
    from app.services.pos.clover import CloverAdapter

    key = (provider or "").strip().lower()
    if key in ("square", "square_demo"):
        raise ValueError("Square POS is no longer supported")
    if key == "clover":
        return CloverAdapter()
    if key in ("clear_mock", "mock", "demo"):
        return ClearMockAdapter()
    raise ValueError(f"Unsupported POS provider: {provider}")
