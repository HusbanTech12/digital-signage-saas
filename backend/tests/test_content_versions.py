"""Content versioning service tests."""

from __future__ import annotations

from db.models.content_version import CONTENT_ENTITY_TYPES, CONTENT_STATUSES


def test_content_version_constants():
    assert set(CONTENT_ENTITY_TYPES) == {"menu", "template", "playlist"}
    assert "draft" in CONTENT_STATUSES
    assert "published" in CONTENT_STATUSES
    assert "archived" in CONTENT_STATUSES


def test_item_from_snap_helper():
    from app.services.display_content import _item_from_snap

    item = _item_from_snap(
        {
            "id": "item_1",
            "menuId": "menu_1",
            "organizationId": "org_1",
            "name": "Burger",
            "price": 9.5,
            "description": "Nice",
            "imageUrl": None,
            "available": True,
            "sortOrder": 1,
            "category": "Mains",
        }
    )
    assert item.name == "Burger"
    assert item.price == 9.5
    assert item.menu_id == "menu_1"


def test_playlist_from_snapshot_empty():
    from app.services.display_content import _playlist_from_snapshot

    assert _playlist_from_snapshot({}) is None
    assert _playlist_from_snapshot({"slides": []}) is None


def test_playlist_from_snapshot_slide():
    from app.services.display_content import _playlist_from_snapshot

    playback = _playlist_from_snapshot(
        {
            "id": "pl_1",
            "name": "Lunch",
            "version": 3,
            "loop": True,
            "priority": 1,
            "slides": [
                {
                    "id": "s1",
                    "sortOrder": 0,
                    "contentType": "image",
                    "durationSeconds": 8,
                    "mediaUrl": "https://example.com/a.jpg",
                    "mediaName": "Promo",
                }
            ],
        }
    )
    assert playback is not None
    assert playback.name == "Lunch"
    assert playback.version == 3
    assert len(playback.slides) == 1
    assert playback.slides[0].media_url == "https://example.com/a.jpg"
