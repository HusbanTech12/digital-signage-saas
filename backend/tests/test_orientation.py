"""Orientation is the only screen-shape setting — no pixel dimensions required."""

from __future__ import annotations

from app.schemas.template import TemplatePublishOut
from app.services.template_publish import orientation_mismatch_screen_ids
from app.utils.orientation import (
    board_size,
    nominal_resolution,
    orientation_of_board,
)


class _Screen:
    def __init__(self, screen_id: str, orientation: str | None):
        self.id = screen_id
        self.orientation = orientation


class _Template:
    def __init__(self, orientation: str | None):
        self.orientation = orientation


def test_board_size_matches_orientation_aspect():
    landscape_w, landscape_h = board_size("landscape")
    portrait_w, portrait_h = board_size("portrait")
    assert landscape_w > landscape_h
    assert portrait_h > portrait_w
    # Same 16:9 family, just transposed.
    assert (landscape_w, landscape_h) == (portrait_h, portrait_w)


def test_board_size_defaults_to_landscape():
    assert board_size(None) == board_size("landscape")
    assert board_size("something-else") == board_size("landscape")


def test_nominal_resolution_follows_orientation():
    assert nominal_resolution("landscape") == "1920x1080"
    assert nominal_resolution("portrait") == "1080x1920"
    assert nominal_resolution(None) == "1920x1080"


def test_orientation_of_board_round_trips():
    for orientation in ("landscape", "portrait"):
        width, height = board_size(orientation)
        assert orientation_of_board(width, height) == orientation


def test_square_board_reads_as_landscape():
    assert orientation_of_board(1000, 1000) == "landscape"


def test_orientation_mismatch_flags_only_differing_screens():
    template = _Template("portrait")
    screens = [
        _Screen("scr_ok", "portrait"),
        _Screen("scr_bad", "landscape"),
        _Screen("scr_default", None),
    ]
    assert orientation_mismatch_screen_ids(template, screens) == [
        "scr_bad",
        "scr_default",
    ]


def test_orientation_mismatch_empty_when_all_match():
    template = _Template("landscape")
    screens = [_Screen("a", "landscape"), _Screen("b", None)]
    assert orientation_mismatch_screen_ids(template, screens) == []


def test_publish_out_defaults_mismatch_list_to_empty():
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
            "resolution": "1080x1920",
            "orientation": "portrait",
            "createdAt": now,
            "updatedAt": now,
        },
        screen_ids=["scr_1"],
        version=1,
    )
    assert out.orientation_mismatch_screen_ids == []
    assert out.model_dump(by_alias=True)["orientationMismatchScreenIds"] == []
