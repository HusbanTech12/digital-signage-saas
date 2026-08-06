"""Square-shaped webhook adapter (works with real-ish Square catalog payloads + demo)."""

from __future__ import annotations

from typing import Any

from app.services.pos.base import POSAdapter
from app.services.pos.events import AvailabilityUpdateEvent, PosEvent, PriceUpdateEvent


class SquareAdapter(POSAdapter):
    provider = "square"

    def parse_webhook(self, payload: dict[str, Any]) -> list[PosEvent]:
        events: list[PosEvent] = []

        # Demo / simulate envelope: { "updates": [ ... ] }
        updates = payload.get("updates")
        if isinstance(updates, list):
            for row in updates:
                if not isinstance(row, dict):
                    continue
                events.extend(self._parse_update_row(row))
            if events:
                return events

        # Square catalog.version.updated style (simplified)
        data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
        obj = data.get("object") if isinstance(data.get("object"), dict) else {}
        catalog = obj.get("catalog_version") or obj.get("catalog_object") or obj

        # Single object update
        if isinstance(catalog, dict) and (
            "item_data" in catalog or catalog.get("type") == "ITEM"
        ):
            events.extend(self._parse_catalog_object(catalog))

        # Batch objects
        objects = payload.get("catalog_objects") or data.get("catalog_objects") or []
        if isinstance(objects, list):
            for obj_row in objects:
                if isinstance(obj_row, dict):
                    events.extend(self._parse_catalog_object(obj_row))

        # Flat convenience fields for curl demos
        if not events:
            events.extend(self._parse_update_row(payload))

        if not events:
            raise ValueError("No price/availability updates found in Square payload")
        return events

    def _parse_update_row(self, row: dict[str, Any]) -> list[PosEvent]:
        kind = row.get("type")
        sku = row.get("externalSku") or row.get("sku") or row.get("external_sku")
        if not isinstance(sku, str) or not sku:
            return []
        out: list[PosEvent] = []
        if kind == "price_update" or "price" in row:
            if "price" in row:
                out.append(
                    PriceUpdateEvent(
                        type="price_update",
                        external_sku=sku,
                        price=float(row["price"]),
                    )
                )
        if kind == "availability_update" or "available" in row:
            if "available" in row:
                out.append(
                    AvailabilityUpdateEvent(
                        type="availability_update",
                        external_sku=sku,
                        available=bool(row["available"]),
                    )
                )
        return out

    def _parse_catalog_object(self, obj: dict[str, Any]) -> list[PosEvent]:
        item_data = obj.get("item_data") if isinstance(obj.get("item_data"), dict) else {}
        variations = item_data.get("variations") or []
        events: list[PosEvent] = []
        if not isinstance(variations, list):
            return events
        for variation in variations:
            if not isinstance(variation, dict):
                continue
            var_data = (
                variation.get("item_variation_data")
                if isinstance(variation.get("item_variation_data"), dict)
                else {}
            )
            sku = var_data.get("sku") or variation.get("id") or obj.get("id")
            if not isinstance(sku, str) or not sku:
                continue
            price_money = var_data.get("price_money")
            if isinstance(price_money, dict) and "amount" in price_money:
                # Square amounts are in cents
                amount = float(price_money["amount"]) / 100.0
                events.append(
                    PriceUpdateEvent(
                        type="price_update",
                        external_sku=sku,
                        price=amount,
                        currency=str(price_money.get("currency") or "USD"),
                    )
                )
            if "available_for_booking" in var_data:
                events.append(
                    AvailabilityUpdateEvent(
                        type="availability_update",
                        external_sku=sku,
                        available=bool(var_data["available_for_booking"]),
                    )
                )
            elif "sellable" in var_data:
                events.append(
                    AvailabilityUpdateEvent(
                        type="availability_update",
                        external_sku=sku,
                        available=bool(var_data["sellable"]),
                    )
                )
        return events
