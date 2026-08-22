"""Background audio playlist helpers."""

from __future__ import annotations

from db.models.audio_playlist import AUDIO_PLAYLIST_STATUSES


def test_audio_playlist_statuses():
    assert "draft" in AUDIO_PLAYLIST_STATUSES
    assert "published" in AUDIO_PLAYLIST_STATUSES


def test_audio_permissions_on_roles():
    from app.auth.permissions import (
        AUDIO_CREATE,
        AUDIO_PUBLISH,
        AUDIO_READ,
        has_permission,
        permissions_for_role,
    )

    assert AUDIO_READ in permissions_for_role("viewer")
    assert AUDIO_CREATE in permissions_for_role("content_manager")
    assert AUDIO_PUBLISH in permissions_for_role("location_manager")

    class U:
        def __init__(self, role: str, status: str = "active"):
            self.role = role
            self.status = status

    assert has_permission(U("admin"), AUDIO_PUBLISH)
    assert not has_permission(U("viewer"), AUDIO_CREATE)


def test_audio_playback_schema():
    from app.schemas.audio_playlist import AudioPlaybackOut, AudioTrackPlaybackOut

    playback = AudioPlaybackOut(
        playlist_id="apl_1",
        name="Lobby",
        version=2,
        loop=True,
        volume=0.4,
        muted=False,
        tracks=[
            AudioTrackPlaybackOut(
                id="atr_1",
                url="/api/v1/media/content/org/a/x.mp3",
                mime_type="audio/mpeg",
                name="Track 1",
            )
        ],
    )
    dumped = playback.model_dump(by_alias=True)
    assert dumped["playlistId"] == "apl_1"
    assert dumped["tracks"][0]["mimeType"] == "audio/mpeg"
