"""Clover REST + OAuth v2 adapter (inventory fetch, webhooks, simulate envelope)."""

from __future__ import annotations

import logging
import time
from typing import Any

import httpx
from fastapi import HTTPException

from app.config import get_settings
from app.services.pos.base import POSAdapter
from app.services.pos.catalog import CatalogItem
from app.services.pos.events import (
    AvailabilityUpdateEvent,
    PosEvent,
    PriceUpdateEvent,
    parse_demo_envelope,
    parse_update_row,
    try_parse_demo_envelope,
)

logger = logging.getLogger(__name__)

_CLOVER_HOSTS = {
    ("sandbox", "na"): {
        "oauth": "https://sandbox.dev.clover.com",
        "api": "https://apisandbox.dev.clover.com",
    },
    ("production", "na"): {
        "oauth": "https://www.clover.com",
        "api": "https://api.clover.com",
    },
    ("production", "eu"): {
        "oauth": "https://www.eu.clover.com",
        "api": "https://api.eu.clover.com",
    },
    ("production", "la"): {
        "oauth": "https://www.la.clover.com",
        "api": "https://api.la.clover.com",
    },
}


def clover_hosts() -> dict[str, str]:
    settings = get_settings()
    env = (settings.clover_env or "sandbox").strip().lower()
    region = (settings.clover_region or "na").strip().lower()
    if env not in {"sandbox", "production"}:
        env = "sandbox"
    if env == "sandbox":
        region = "na"
    return _CLOVER_HOSTS.get((env, region), _CLOVER_HOSTS[("sandbox", "na")])


def _item_sku(item: dict[str, Any]) -> str | None:
    for key in ("sku", "code", "alternateName", "id"):
        value = item.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _item_available(item: dict[str, Any]) -> bool:
    if item.get("hidden") is True:
        return False
    if item.get("available") is False:
        return False
    stock = item.get("itemStock")
    if isinstance(stock, dict) and stock.get("quantity") is not None:
        try:
            return float(stock["quantity"]) > 0
        except (TypeError, ValueError):
            pass
    return True


def _item_price(item: dict[str, Any]) -> float | None:
    raw = item.get("price")
    if raw is None:
        return None
    try:
        return round(float(raw) / 100.0, 2)
    except (TypeError, ValueError):
        return None


def catalog_item_from_clover(item: dict[str, Any]) -> CatalogItem | None:
    sku = _item_sku(item)
    if not sku:
        return None
    name = item.get("name")
    return CatalogItem(
        external_sku=sku,
        name=str(name) if name else sku,
        price=_item_price(item),
        available=_item_available(item),
        external_id=str(item["id"]) if item.get("id") else None,
    )


def events_from_clover_item(item: dict[str, Any]) -> list[PosEvent]:
    sku = _item_sku(item)
    if not sku:
        return []
    out: list[PosEvent] = []
    price = _item_price(item)
    if price is not None:
        out.append(
            PriceUpdateEvent(type="price_update", external_sku=sku, price=price)
        )
    out.append(
        AvailabilityUpdateEvent(
            type="availability_update",
            external_sku=sku,
            available=_item_available(item),
        )
    )
    return out


def inventory_object_ids(payload: dict[str, Any]) -> list[tuple[str, str, str]]:
    """Return (merchant_id, object_type, object_id) for inventory updates."""
    merchants = payload.get("merchants")
    if not isinstance(merchants, dict):
        return []
    rows: list[tuple[str, str, str]] = []
    for merchant_id, updates in merchants.items():
        if not isinstance(updates, list):
            continue
        for update in updates:
            if not isinstance(update, dict):
                continue
            object_id = update.get("objectId") or update.get("object_id")
            if not isinstance(object_id, str) or ":" not in object_id:
                continue
            kind, raw_id = object_id.split(":", 1)
            if kind != "I" or not raw_id:
                continue
            op = str(update.get("type") or "UPDATE").upper()
            rows.append((str(merchant_id), op, raw_id))
    return rows


class CloverAdapter(POSAdapter):
    provider = "clover"
    supports_oauth = True

    def parse_webhook(self, payload: dict[str, Any]) -> list[PosEvent]:
        updates = payload.get("updates")
        if isinstance(updates, list):
            return parse_demo_envelope(payload)
        events = parse_update_row(payload)
        if events:
            return events
        # Inventory webhooks need a live item fetch — see resolve_events.
        if inventory_object_ids(payload):
            return []
        raise ValueError("No price/availability updates found in Clover payload")

    def verify_webhook(
        self,
        *,
        credentials: dict[str, Any],
        authorization: str | None,
        x_pos_signature: str | None,
        x_clover_auth: str | None,
    ) -> None:
        settings = get_settings()
        app_auth = (settings.clover_webhook_auth or "").strip()
        secret = credentials.get("webhookSecret") or credentials.get("webhook_secret")
        expected = str(secret or app_auth)
        if not expected:
            return
        token = x_clover_auth or x_pos_signature
        if authorization and authorization.lower().startswith("bearer "):
            token = authorization.split(" ", 1)[1].strip()
        if token != expected:
            raise HTTPException(status_code=401, detail="Invalid POS webhook secret")

    def authorize_url(self, *, redirect_uri: str, state: str) -> str:
        settings = get_settings()
        if not settings.clover_app_id:
            raise HTTPException(
                status_code=400,
                detail="Clover OAuth is not configured (CLOVER_APP_ID)",
            )
        hosts = clover_hosts()
        from urllib.parse import urlencode

        query = urlencode(
            {
                "client_id": settings.clover_app_id,
                "response_type": "code",
                "redirect_uri": redirect_uri,
                "state": state,
            }
        )
        return f"{hosts['oauth']}/oauth/v2/authorize?{query}"

    async def exchange_code(
        self,
        *,
        code: str,
        merchant_id: str | None,
    ) -> dict[str, Any]:
        settings = get_settings()
        if not settings.clover_app_id or not settings.clover_app_secret:
            raise HTTPException(
                status_code=400,
                detail="Clover OAuth is not configured (CLOVER_APP_ID / CLOVER_APP_SECRET)",
            )
        hosts = clover_hosts()
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                f"{hosts['api']}/oauth/v2/token",
                json={
                    "client_id": settings.clover_app_id,
                    "client_secret": settings.clover_app_secret,
                    "code": code,
                },
            )
        if response.status_code >= 400:
            raise HTTPException(
                status_code=400,
                detail=f"Clover token exchange failed ({response.status_code})",
            )
        data = response.json()
        creds: dict[str, Any] = {
            "accessToken": data.get("access_token"),
            "refreshToken": data.get("refresh_token"),
            "accessTokenExpiration": data.get("access_token_expiration"),
            "refreshTokenExpiration": data.get("refresh_token_expiration"),
        }
        if merchant_id:
            creds["merchantId"] = merchant_id
        return creds

    async def fetch_catalog(
        self,
        credentials: dict[str, Any],
        config: dict[str, Any],
    ) -> list[CatalogItem]:
        items = await self._list_items(credentials)
        catalog: list[CatalogItem] = []
        for item in items:
            row = catalog_item_from_clover(item)
            if row:
                catalog.append(row)
        return catalog

    async def resolve_events(
        self,
        payload: dict[str, Any],
        credentials: dict[str, Any],
        config: dict[str, Any],
    ) -> list[PosEvent]:
        parsed = self._try_parse_demo(payload)
        if parsed is not None:
            return parsed
        return await self._events_from_inventory_webhook(payload, credentials)

    def resolve_events_sync(
        self,
        payload: dict[str, Any],
        credentials: dict[str, Any],
        config: dict[str, Any],
    ) -> list[PosEvent]:
        parsed = self._try_parse_demo(payload)
        if parsed is not None:
            return parsed
        return self._events_from_inventory_webhook_sync(payload, credentials)

    def _try_parse_demo(self, payload: dict[str, Any]) -> list[PosEvent] | None:
        parsed = try_parse_demo_envelope(payload)
        if parsed is not None:
            return parsed
        if inventory_object_ids(payload):
            return None
        return None

    async def _events_from_inventory_webhook(
        self,
        payload: dict[str, Any],
        credentials: dict[str, Any],
    ) -> list[PosEvent]:
        events: list[PosEvent] = []
        merchant_filter = credentials.get("merchantId")
        for merchant_id, op, item_id in inventory_object_ids(payload):
            if merchant_filter and merchant_id != merchant_filter:
                continue
            if op == "DELETE":
                events.append(
                    AvailabilityUpdateEvent(
                        type="availability_update",
                        external_sku=item_id,
                        available=False,
                    )
                )
                continue
            item = await self._get_item(credentials, merchant_id, item_id)
            events.extend(events_from_clover_item(item))
        if not events:
            raise ValueError("No Clover inventory updates could be resolved")
        return events

    def _events_from_inventory_webhook_sync(
        self,
        payload: dict[str, Any],
        credentials: dict[str, Any],
    ) -> list[PosEvent]:
        events: list[PosEvent] = []
        merchant_filter = credentials.get("merchantId")
        for merchant_id, op, item_id in inventory_object_ids(payload):
            if merchant_filter and merchant_id != merchant_filter:
                continue
            if op == "DELETE":
                events.append(
                    AvailabilityUpdateEvent(
                        type="availability_update",
                        external_sku=item_id,
                        available=False,
                    )
                )
                continue
            item = self._get_item_sync(credentials, merchant_id, item_id)
            events.extend(events_from_clover_item(item))
        if not events:
            raise ValueError("No Clover inventory updates could be resolved")
        return events

    async def _list_items(self, credentials: dict[str, Any]) -> list[dict[str, Any]]:
        token, merchant_id = await self._auth_context(credentials)
        hosts = clover_hosts()
        collected: list[dict[str, Any]] = []
        offset = 0
        async with httpx.AsyncClient(timeout=20.0) as client:
            while True:
                response = await client.get(
                    f"{hosts['api']}/v3/merchants/{merchant_id}/items",
                    params={"expand": "itemStock", "limit": 100, "offset": offset},
                    headers={"Authorization": f"Bearer {token}"},
                )
                if response.status_code >= 400:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Clover inventory fetch failed ({response.status_code})",
                    )
                elements = response.json().get("elements") or []
                if not isinstance(elements, list) or not elements:
                    break
                collected.extend(row for row in elements if isinstance(row, dict))
                if len(elements) < 100:
                    break
                offset += 100
        return collected

    async def _get_item(
        self,
        credentials: dict[str, Any],
        merchant_id: str,
        item_id: str,
    ) -> dict[str, Any]:
        token, cred_merchant = await self._auth_context(credentials)
        mid = merchant_id or cred_merchant
        hosts = clover_hosts()
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(
                f"{hosts['api']}/v3/merchants/{mid}/items/{item_id}",
                params={"expand": "itemStock"},
                headers={"Authorization": f"Bearer {token}"},
            )
        if response.status_code >= 400:
            raise HTTPException(
                status_code=400,
                detail=f"Clover item {item_id} fetch failed ({response.status_code})",
            )
        data = response.json()
        return data if isinstance(data, dict) else {}

    def _get_item_sync(
        self,
        credentials: dict[str, Any],
        merchant_id: str,
        item_id: str,
    ) -> dict[str, Any]:
        token, cred_merchant = self._auth_context_sync(credentials)
        mid = merchant_id or cred_merchant
        hosts = clover_hosts()
        with httpx.Client(timeout=20.0) as client:
            response = client.get(
                f"{hosts['api']}/v3/merchants/{mid}/items/{item_id}",
                params={"expand": "itemStock"},
                headers={"Authorization": f"Bearer {token}"},
            )
        if response.status_code >= 400:
            raise HTTPException(
                status_code=400,
                detail=f"Clover item {item_id} fetch failed ({response.status_code})",
            )
        data = response.json()
        return data if isinstance(data, dict) else {}

    async def _auth_context(self, credentials: dict[str, Any]) -> tuple[str, str]:
        creds = await self._ensure_token(credentials)
        token = creds.get("accessToken")
        merchant_id = creds.get("merchantId")
        if not token or not merchant_id:
            raise HTTPException(
                status_code=400,
                detail="Clover is not connected. Use Connect Clover in Settings.",
            )
        return str(token), str(merchant_id)

    def _auth_context_sync(self, credentials: dict[str, Any]) -> tuple[str, str]:
        token = credentials.get("accessToken")
        merchant_id = credentials.get("merchantId")
        if not token or not merchant_id:
            raise HTTPException(
                status_code=400,
                detail="Clover is not connected. Use Connect Clover in Settings.",
            )
        return str(token), str(merchant_id)

    async def _ensure_token(self, credentials: dict[str, Any]) -> dict[str, Any]:
        token = credentials.get("accessToken")
        exp = credentials.get("accessTokenExpiration")
        refresh = credentials.get("refreshToken")
        now = int(time.time())
        if token and (not exp or int(exp) - 60 > now):
            return credentials
        if not refresh:
            return credentials
        settings = get_settings()
        hosts = clover_hosts()
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                f"{hosts['api']}/oauth/v2/refresh",
                json={
                    "client_id": settings.clover_app_id,
                    "refresh_token": refresh,
                },
            )
        if response.status_code >= 400:
            logger.warning("Clover refresh failed: %s", response.status_code)
            return credentials
        data = response.json()
        credentials["accessToken"] = data.get("access_token") or token
        if data.get("refresh_token"):
            credentials["refreshToken"] = data["refresh_token"]
        if data.get("access_token_expiration"):
            credentials["accessTokenExpiration"] = data["access_token_expiration"]
        if data.get("refresh_token_expiration"):
            credentials["refreshTokenExpiration"] = data["refresh_token_expiration"]
        return credentials
