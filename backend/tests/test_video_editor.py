"""Video editor helpers on media assets."""

from __future__ import annotations

from app.services.media import _clamp01, _validate_trim


def test_clamp01():
    assert _clamp01(None) is None
    assert _clamp01(-1) == 0.0
    assert _clamp01(2) == 1.0
    assert _clamp01(0.5) == 0.5


def test_validate_trim_ok():
    start, end = _validate_trim(1.0, 5.0, 10.0)
    assert start == 1.0
    assert end == 5.0


def test_media_asset_out_video_fields():
    from datetime import datetime, timezone

    from app.schemas.media import MediaAssetOut

    now = datetime.now(timezone.utc)
    out = MediaAssetOut(
        id="media_1",
        organization_id="org_1",
        folder_id=None,
        name="Clip",
        original_filename="clip.mp4",
        kind="video",
        mime_type="video/mp4",
        size_bytes=1000,
        storage_key="org_1/media_1/clip.mp4",
        url="/api/v1/media/content/org_1/media_1/clip.mp4",
        duration_seconds=12.5,
        poster_url="/api/v1/media/content/org_1/media_1/poster.jpg",
        trim_start_seconds=1.0,
        trim_end_seconds=8.0,
        muted=True,
        loop=False,
        tags=[],
        usage_count=0,
        uploaded_by_user_id=None,
        created_at=now,
        updated_at=now,
    )
    dumped = out.model_dump(by_alias=True)
    assert dumped["posterUrl"].endswith("poster.jpg")
    assert dumped["trimStartSeconds"] == 1.0
    assert dumped["muted"] is True
