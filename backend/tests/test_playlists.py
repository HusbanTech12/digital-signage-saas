"""Playlist API smoke tests (service helpers + permissions)."""

from __future__ import annotations

from app.auth.permissions import (
    PLAYLISTS_CREATE,
    PLAYLISTS_PUBLISH,
    PLAYLISTS_READ,
    has_permission,
    permissions_for_role,
)
from db.models.playlist import PLAYLIST_CONTENT_TYPES, PLAYLIST_STATUSES


def test_playlist_permissions_on_roles():
    assert PLAYLISTS_READ in permissions_for_role("content_manager")
    assert PLAYLISTS_CREATE in permissions_for_role("content_manager")
    assert PLAYLISTS_PUBLISH in permissions_for_role("location_manager")
    assert PLAYLISTS_READ in permissions_for_role("viewer")
    assert PLAYLISTS_CREATE not in permissions_for_role("viewer")


def test_playlist_constants():
    assert "draft" in PLAYLIST_STATUSES
    assert "published" in PLAYLIST_STATUSES
    assert set(PLAYLIST_CONTENT_TYPES) == {"menu", "template", "image", "video"}


class _User:
    def __init__(self, role: str, status: str = "active"):
        self.role = role
        self.status = status


def test_has_permission_playlist():
    assert has_permission(_User("admin"), PLAYLISTS_PUBLISH)
    assert not has_permission(_User("viewer"), PLAYLISTS_PUBLISH)
    assert not has_permission(_User("admin", status="suspended"), PLAYLISTS_READ)
