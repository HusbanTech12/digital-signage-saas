"""Advanced device management — pairing TTL + heartbeat helpers."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.services.pairing import (
    PAIRING_TTL,
    _effective_pairing_expires,
    pairing_expires_at,
)


class _Screen:
    def __init__(
        self,
        *,
        pairing_expires_at=None,
        last_heartbeat=None,
        created_at=None,
        status="pairing",
        pairing_code="123456",
    ):
        self.pairing_expires_at = pairing_expires_at
        self.last_heartbeat = last_heartbeat
        self.created_at = created_at or datetime.now(timezone.utc)
        self.status = status
        self.pairing_code = pairing_code


def test_pairing_ttl_is_fifteen_minutes():
    assert PAIRING_TTL == timedelta(minutes=15)


def test_pairing_expires_at_adds_ttl():
    started = datetime(2026, 8, 22, 12, 0, tzinfo=timezone.utc)
    assert pairing_expires_at(started) == started + PAIRING_TTL


def test_effective_pairing_expires_prefers_stored_field():
    stored = datetime(2026, 8, 22, 13, 0, tzinfo=timezone.utc)
    screen = _Screen(
        pairing_expires_at=stored,
        last_heartbeat=datetime(2026, 8, 22, 12, 0, tzinfo=timezone.utc),
    )
    assert _effective_pairing_expires(screen) == stored


def test_effective_pairing_expires_falls_back_to_heartbeat():
    started = datetime(2026, 8, 22, 12, 0, tzinfo=timezone.utc)
    screen = _Screen(pairing_expires_at=None, last_heartbeat=started)
    assert _effective_pairing_expires(screen) == started + PAIRING_TTL


def test_truncate_error_helper():
    from app.routes.screens import _truncate_error

    assert _truncate_error(None) is None
    assert _truncate_error("  ") is None
    assert _truncate_error("ok") == "ok"
    long = "x" * 2000
    assert len(_truncate_error(long) or "") == 1000
