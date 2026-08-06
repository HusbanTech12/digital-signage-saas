"""POS adapter interface — one contract, provider-specific parsers."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from app.services.pos.events import PosEvent


class POSAdapter(ABC):
    provider: str

    @abstractmethod
    def parse_webhook(self, payload: dict[str, Any]) -> list[PosEvent]:
        """Normalize provider webhook JSON into Price/Availability events."""


def get_adapter(provider: str) -> POSAdapter:
    from app.services.pos.clear_mock import ClearMockAdapter
    from app.services.pos.square import SquareAdapter

    key = (provider or "").strip().lower()
    if key in ("square", "square_demo"):
        return SquareAdapter()
    if key in ("clear_mock", "mock", "demo"):
        return ClearMockAdapter()
    raise ValueError(f"Unsupported POS provider: {provider}")
