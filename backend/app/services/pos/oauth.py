"""Signed OAuth state for POS connect flows (Clover)."""

from __future__ import annotations

import hashlib
import hmac
import secrets
import time

from app.config import get_settings


def _secret() -> bytes:
    settings = get_settings()
    raw = (
        settings.clover_app_secret
        or settings.clerk_secret_key
        or "dev-pos-oauth-state"
    )
    return raw.encode("utf-8")


def encode_oauth_state(integration_id: str, *, ttl_seconds: int = 600) -> str:
    nonce = secrets.token_hex(8)
    exp = str(int(time.time()) + ttl_seconds)
    payload = f"{integration_id}.{nonce}.{exp}"
    sig = hmac.new(_secret(), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"{payload}.{sig}"


def decode_oauth_state(state: str) -> str:
    parts = (state or "").split(".")
    if len(parts) != 4:
        raise ValueError("Invalid OAuth state")
    integration_id, nonce, exp, sig = parts
    payload = f"{integration_id}.{nonce}.{exp}"
    expected = hmac.new(_secret(), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, sig):
        raise ValueError("Invalid OAuth state signature")
    if int(exp) < int(time.time()):
        raise ValueError("OAuth state expired")
    if not integration_id.startswith("pos_"):
        raise ValueError("Invalid integration in OAuth state")
    return integration_id
