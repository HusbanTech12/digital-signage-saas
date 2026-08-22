from datetime import datetime
from typing import Literal

from pydantic import Field

from app.schemas.common import CamelModel

AudioPlaylistStatus = Literal["draft", "published", "archived"]


class AudioTrackIn(CamelModel):
    media_asset_id: str
    label: str | None = None
    sort_order: int | None = Field(default=None, ge=0)


class AudioTrackOut(CamelModel):
    id: str
    audio_playlist_id: str
    organization_id: str
    sort_order: int
    media_asset_id: str
    label: str | None
    media_name: str | None = None
    media_url: str | None = None
    media_mime_type: str | None = None
    duration_seconds: float | None = None
    created_at: datetime


class AudioPlaylistCreate(CamelModel):
    name: str = Field(min_length=1, max_length=255)
    description: str = ""
    loop: bool = True
    volume: float = Field(default=0.5, ge=0, le=1)
    tracks: list[AudioTrackIn] = Field(default_factory=list)


class AudioPlaylistUpdate(CamelModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    loop: bool | None = None
    volume: float | None = Field(default=None, ge=0, le=1)
    status: AudioPlaylistStatus | None = None
    tracks: list[AudioTrackIn] | None = None


class AudioPlaylistOut(CamelModel):
    id: str
    organization_id: str
    name: str
    description: str
    status: str
    version: int
    loop: bool
    volume: float
    published_at: datetime | None
    created_by_user_id: str | None
    published_by_user_id: str | None = None
    created_at: datetime
    updated_at: datetime
    tracks: list[AudioTrackOut] = Field(default_factory=list)
    track_count: int = 0


class AudioPlaylistListOut(CamelModel):
    audio_playlists: list[AudioPlaylistOut]
    total: int


class PublishAudioPlaylistIn(CamelModel):
    screen_ids: list[str] = Field(default_factory=list)
    bump_version: bool = True


class AudioTrackPlaybackOut(CamelModel):
    id: str
    url: str
    mime_type: str | None = None
    name: str | None = None
    duration_seconds: float | None = None


class AudioPlaybackOut(CamelModel):
    playlist_id: str
    name: str
    version: int
    loop: bool
    volume: float
    muted: bool
    tracks: list[AudioTrackPlaybackOut] = Field(default_factory=list)
