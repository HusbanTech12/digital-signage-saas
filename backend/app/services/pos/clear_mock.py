"""ClearMock adapter — simplest demo payload for local/dev."""

from __future__ import annotations

from typing import Any

from app.services.pos.base import POSAdapter
from app.services.pos.events import PosEvent, parse_demo_envelope


class ClearMockAdapter(POSAdapter):
    provider = "clear_mock"

    def parse_webhook(self, payload: dict[str, Any]) -> list[PosEvent]:
        return parse_demo_envelope(payload)
