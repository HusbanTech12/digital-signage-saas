"""Screen group / video wall helpers."""

from __future__ import annotations

from app.services.screen_groups import LAYOUT_DIMS, layout_dims, seat_count
from db.models.screen_group import SCREEN_GROUP_CONTENT_MODES, SCREEN_GROUP_LAYOUTS


def test_layout_presets():
    assert LAYOUT_DIMS["2x2"] == (2, 2)
    assert LAYOUT_DIMS["3x3"] == (3, 3)
    assert LAYOUT_DIMS["4x4"] == (4, 4)
    assert seat_count("2x2") == 4
    assert seat_count("3x3") == 9
    assert seat_count("4x4") == 16


def test_custom_layout_dims():
    assert layout_dims("custom", 2, 3) == (2, 3)


def test_screen_group_constants():
    assert "2x2" in SCREEN_GROUP_LAYOUTS
    assert "shared" in SCREEN_GROUP_CONTENT_MODES
    assert "tiled" in SCREEN_GROUP_CONTENT_MODES


def test_wall_info_out_schema():
    from app.schemas.display import WallInfoOut

    wall = WallInfoOut(
        group_id="sg_1",
        group_name="Lobby",
        layout="2x2",
        rows=2,
        cols=2,
        row=0,
        col=1,
        content_mode="shared",
        sync_epoch_ms=1_700_000_000_000,
    )
    dumped = wall.model_dump(by_alias=True)
    assert dumped["groupId"] == "sg_1"
    assert dumped["syncEpochMs"] == 1_700_000_000_000
    assert dumped["col"] == 1
