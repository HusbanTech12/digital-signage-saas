from datetime import datetime
from typing import Any, Literal

from pydantic import Field, field_validator

from app.schemas.common import CamelModel
from app.schemas.menu import MenuItemOut

PlaylistStatus = Literal["draft", "published", "archived"]
PlaylistContentType = Literal["menu", "template", "image", "video"]


class PlaylistItemIn(CamelModel):
    content_type: PlaylistContentType
    duration_seconds: int = Field(default=10, ge=1, le=3600)
    label: str | None = None
    menu_id: str | None = None
    template_id: str | None = None
    media_asset_id: str | None = None
    transition: str | None = None
    sort_order: int | None = Field(default=None, ge=0)

    @field_validator("transition", mode="before")
    @classmethod
    def empty_transition(cls, v: object) -> object:
        if v == "":
            return None
        return v


class PlaylistItemOut(CamelModel):
    id: str
    playlist_id: str
    organization_id: str
    sort_order: int
    content_type: str
    duration_seconds: int
    label: str | None
    menu_id: str | None
    template_id: str | None
    media_asset_id: str | None
    transition: str | None
    meta: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class PlaylistCreate(CamelModel):
    name: str = Field(min_length=1, max_length=255)
    description: str = ""
    loop: bool = True
    priority: int = Field(default=0, ge=0, le=1000)
    items: list[PlaylistItemIn] = Field(default_factory=list)


class PlaylistUpdate(CamelModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    loop: bool | None = None
    priority: int | None = Field(default=None, ge=0, le=1000)
    status: PlaylistStatus | None = None
    items: list[PlaylistItemIn] | None = None


class PlaylistOut(CamelModel):
    id: str
    organization_id: str
    name: str
    description: str
    status: str
    version: int
    priority: int
    loop: bool
    published_at: datetime | None
    created_by_user_id: str | None
    published_by_user_id: str | None = None
    created_at: datetime
    updated_at: datetime
    items: list[PlaylistItemOut] = Field(default_factory=list)
    item_count: int = 0


class PlaylistListOut(CamelModel):
    playlists: list[PlaylistOut]
    total: int


class PublishPlaylistIn(CamelModel):
    screen_ids: list[str] = Field(default_factory=list)
    # When true, bump version even if already published.
    bump_version: bool = True
    change_summary: str | None = None


class PlaylistSlideOut(CamelModel):
    """Resolved slide content for kiosk playback."""

    id: str
    sort_order: int
    content_type: str
    duration_seconds: int
    label: str | None = None
    transition: str | None = None
    menu_id: str | None = None
    menu_name: str | None = None
    menu_version: int | None = None
    items: list[MenuItemOut] = Field(default_factory=list)
    template_id: str | None = None
    template_name: str | None = None
    canvas_json: dict[str, Any] | None = None
    display_config: dict[str, Any] | None = None
    media_url: str | None = None
    media_mime_type: str | None = None
    media_kind: str | None = None
    media_name: str | None = None
    poster_url: str | None = None
    muted: bool | None = None
    loop: bool | None = None
    trim_start_seconds: float | None = None
    trim_end_seconds: float | None = None
    crop_x: float | None = None
    crop_y: float | None = None
    crop_w: float | None = None
    crop_h: float | None = None


class PlaylistPlaybackOut(CamelModel):
    id: str
    name: str
    version: int
    loop: bool
    priority: int
    slides: list[PlaylistSlideOut] = Field(default_factory=list)
