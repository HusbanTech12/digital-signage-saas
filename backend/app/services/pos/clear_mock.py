"""ClearMock adapter — simplest demo payload for local/dev."""

from __future__ import annotations

from typing import Any

from app.services.pos.base import POSAdapter
from app.services.pos.events import AvailabilityUpdateEvent, PosEvent, PriceUpdateEvent
from app.services.pos.square import SquareAdapter


class ClearMockAdapter(POSAdapter):
    provider = "clear_mock"

    def parse_webhook(self, payload: dict[str, Any]) -> list[PosEvent]:
        # Reuse Square demo envelope + flat updates
        return SquareAdapter().parse_webhook(payload)
