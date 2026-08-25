"""Template publishing hub — package schema and permissions."""

from __future__ import annotations

from app.auth.permissions import (
    AUDIO_PUBLISH,
    PLAYLISTS_PUBLISH,
    SCREENS_PUBLISH,
    TEMPLATES_UPDATE,
    has_permission,
    permissions_for_role,
)
from app.schemas.template import TemplatePublishIn, TemplatePublishOut
from app.services.template_publish import _ensure_template_slide


def test_content_manager_can_publish_template_package():
    perms = permissions_for_role("content_manager")
    assert SCREENS_PUBLISH in perms
    assert TEMPLATES_UPDATE in perms
    assert PLAYLISTS_PUBLISH in perms
    assert AUDIO_PUBLISH in perms


def test_viewer_cannot_publish_template_package():
    class _User:
        role = "viewer"
        status = "active"

    assert not has_permission(_User(), SCREENS_PUBLISH)
    assert not has_permission(_User(), TEMPLATES_UPDATE)


def test_template_publish_in_accepts_package_fields():
    body = TemplatePublishIn(
        canvas_json={"version": "6.0.0"},
        audio_playlist_id="apl_1",
        audio_volume=0.4,
        audio_loop=True,
        audio_muted=False,
        playlist_id="pl_1",
        playlist_item_duration_seconds=15,
        playlist_item_sort_order=0,
        screen_ids=["scr_1"],
        screen_group_id="sg_1",
        change_summary="Lunch board",
    )
    assert body.screen_ids == ["scr_1"]
    assert body.audio_volume == 0.4
    dumped = body.model_dump(by_alias=True)
    assert dumped["audioPlaylistId"] == "apl_1"
    assert dumped["screenGroupId"] == "sg_1"


def test_template_publish_out_shape():
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)
    out = TemplatePublishOut(
        template={
            "id": "tpl_1",
            "organizationId": "org_1",
            "name": "Board",
            "description": "",
            "thumbnailUrl": None,
            "isGlobal": False,
            "canvasJson": {},
            "displayConfig": {},
            "resolution": "1920x1080",
            "orientation": "landscape",
            "createdAt": now,
            "updatedAt": now,
        },
        screen_ids=["scr_1"],
        playlist_id="pl_1",
        audio_playlist_id="apl_1",
        version=2,
    )
    assert out.version == 2
    assert out.template.id == "tpl_1"


def test_ensure_template_slide_is_importable():
    assert callable(_ensure_template_slide)
