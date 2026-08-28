"""Normalized POS catalog row used by the Settings SKU-map UI."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(slots=True)
class CatalogItem:
    external_sku: str
    name: str
    price: float | None = None
    available: bool | None = None
    external_id: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "externalSku": self.external_sku,
            "name": self.name,
            "price": self.price,
            "available": self.available,
            "externalId": self.external_id,
        }
