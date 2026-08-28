"""POS adapters — Clover and shared event apply pipeline."""

from __future__ import annotations

import pytest

from app.auth.permissions import POS_CONFIGURE, POS_READ, permissions_for_role
from app.services.pos.base import get_adapter
from app.services.pos.clover import CloverAdapter, events_from_clover_item, inventory_object_ids
from app.services.pos.oauth import decode_oauth_state, encode_oauth_state


def test_pos_permissions_on_roles():
    assert POS_READ in permissions_for_role("viewer")
    assert POS_CONFIGURE not in permissions_for_role("viewer")
    assert POS_CONFIGURE in permissions_for_role("admin")
    assert POS_CONFIGURE in permissions_for_role("location_manager")


def test_get_adapter_clover_only():
    assert isinstance(get_adapter("clover"), CloverAdapter)
    assert get_adapter("clover").supports_oauth is True
    with pytest.raises(ValueError, match="no longer supported"):
        get_adapter("square")


def test_clover_simulate_envelope():
    payload = {
        "updates": [
            {"type": "price_update", "externalSku": "SKU-LATTE", "price": 5.25}
        ]
    }
    clover_events = get_adapter("clover").parse_webhook(payload)
    assert len(clover_events) == 1
    assert clover_events[0].external_sku == "SKU-LATTE"
    assert clover_events[0].price == 5.25  # type: ignore[union-attr]


def test_clover_inventory_object_ids():
    payload = {
        "appId": "APP",
        "merchants": {
            "MID123": [
                {"objectId": "I:ITEM99", "type": "UPDATE", "ts": 1},
                {"objectId": "O:ORDER1", "type": "CREATE", "ts": 1},
            ]
        },
    }
    rows = inventory_object_ids(payload)
    assert rows == [("MID123", "UPDATE", "ITEM99")]


def test_clover_item_price_is_cents():
    events = events_from_clover_item(
        {"id": "ABC", "name": "Latte", "sku": "SKU-LATTE", "price": 525, "hidden": False}
    )
    prices = [e for e in events if e.type == "price_update"]
    avail = [e for e in events if e.type == "availability_update"]
    assert prices[0].price == 5.25
    assert avail[0].available is True


def test_oauth_state_roundtrip():
    state = encode_oauth_state("pos_deadbeef")
    assert decode_oauth_state(state) == "pos_deadbeef"


def test_dispatch_falls_back_when_redis_unreachable(monkeypatch):
    from app.services.pos import apply as pos_apply

    monkeypatch.setattr(pos_apply, "_broker_reachable", lambda timeout=0.4: False)
    result = pos_apply.dispatch_pos_event("pse_test")
    assert result["queued"] is False
    assert result["eventId"] == "pse_test"
