"""Unit tests for team permissions, ownership guards, and invitation tokens."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.auth.permissions import (
    TEAM_INVITE,
    TEAM_READ,
    has_permission,
    permissions_for_role,
    require_permission,
)
from app.services.team import (
    assert_not_final_owner_downgrade,
    hash_invite_token,
    invitation_error_detail,
    normalize_email,
)


def _user(**kwargs):
    defaults = {
        "id": "user_1",
        "role": "admin",
        "status": "active",
        "organization_id": "org_1",
        "location_ids": [],
        "email": "a@example.com",
        "name": "A",
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def test_viewer_cannot_invite():
    viewer = _user(role="viewer")
    assert not has_permission(viewer, TEAM_INVITE)
    assert has_permission(viewer, TEAM_READ) is False
    with pytest.raises(HTTPException) as exc:
        require_permission(viewer, TEAM_INVITE)
    assert exc.value.status_code == 403


def test_content_manager_cannot_modify_team():
    cm = _user(role="content_manager")
    assert not has_permission(cm, TEAM_INVITE)
    assert not has_permission(cm, TEAM_READ)
    assert "menus.update" in permissions_for_role("content_manager")


def test_admin_can_manage_team_but_not_transfer_ownership():
    admin = _user(role="admin")
    assert has_permission(admin, TEAM_INVITE)
    assert has_permission(admin, TEAM_READ)
    assert not has_permission(admin, "ownership.transfer")
    owner = _user(role="super_admin")
    assert has_permission(owner, "ownership.transfer")


def test_suspended_user_has_no_permissions():
    user = _user(role="super_admin", status="suspended")
    assert not has_permission(user, TEAM_INVITE)


def test_final_owner_cannot_be_downgraded():
    owner = _user(role="super_admin")
    with pytest.raises(HTTPException) as exc:
        assert_not_final_owner_downgrade(owner, owner_count=1)
    assert "final organization owner" in exc.value.detail


def test_owner_can_be_downgraded_when_another_exists():
    owner = _user(role="super_admin")
    assert_not_final_owner_downgrade(owner, owner_count=2)


def test_token_hash_is_stable_and_not_raw():
    token = "abc123_secret_invite_token_value"
    digest = hash_invite_token(token)
    assert digest == hash_invite_token(token)
    assert token not in digest
    assert len(digest) == 64


def test_invitation_error_states():
    now = datetime.now(timezone.utc)
    pending = SimpleNamespace(
        status="pending",
        expires_at=now + timedelta(days=1),
    )
    assert invitation_error_detail(pending) is None

    expired = SimpleNamespace(status="pending", expires_at=now - timedelta(hours=1))
    assert "expired" in (invitation_error_detail(expired) or "").lower()

    cancelled = SimpleNamespace(status="cancelled", expires_at=now + timedelta(days=1))
    assert "cancelled" in (invitation_error_detail(cancelled) or "").lower()

    accepted = SimpleNamespace(status="accepted", expires_at=now + timedelta(days=1))
    assert "already been used" in (invitation_error_detail(accepted) or "").lower()


def test_normalize_email():
    assert normalize_email("  Foo@Bar.COM ") == "foo@bar.com"
