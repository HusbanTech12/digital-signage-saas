"""Normalized POS events written into menu_items."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal


@dataclass(slots=True)
class PriceUpdateEvent:
    type: Literal["price_update"]
    external_sku: str
    price: float
    menu_item_id: str | None = None
    currency: str = "USD"

    def to_dict(self) -> dict[str, Any]:
        return {
            "type": self.type,
            "externalSku": self.external_sku,
            "price": self.price,
            "menuItemId": self.menu_item_id,
            "currency": self.currency,
        }


@dataclass(slots=True)
class AvailabilityUpdateEvent:
    type: Literal["availability_update"]
    external_sku: str
    available: bool
    menu_item_id: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "type": self.type,
            "externalSku": self.external_sku,
            "available": self.available,
            "menuItemId": self.menu_item_id,
        }


PosEvent = PriceUpdateEvent | AvailabilityUpdateEvent


def event_to_dict(event: PosEvent) -> dict[str, Any]:
    return event.to_dict()


def event_from_dict(data: dict[str, Any]) -> PosEvent:
    kind = data.get("type") or data.get("eventType")
    sku = data.get("externalSku") or data.get("external_sku")
    if not isinstance(sku, str) or not sku:
        raise ValueError("externalSku is required")
    if kind == "price_update":
        return PriceUpdateEvent(
            type="price_update",
            external_sku=sku,
            price=float(data["price"]),
            menu_item_id=data.get("menuItemId") or data.get("menu_item_id"),
            currency=str(data.get("currency") or "USD"),
        )
    if kind == "availability_update":
        return AvailabilityUpdateEvent(
            type="availability_update",
            external_sku=sku,
            available=bool(data["available"]),
            menu_item_id=data.get("menuItemId") or data.get("menu_item_id"),
        )
    raise ValueError(f"Unsupported POS event type: {kind}")
