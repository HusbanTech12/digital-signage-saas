from datetime import datetime

from pydantic import Field

from app.schemas.common import CamelModel

MEDIA_KINDS = ("image", "video", "audio", "logo", "promo", "other")


class MediaFolderOut(CamelModel):
    id: str
    organization_id: str
    parent_id: str | None
    name: str
    created_by_user_id: str | None
    created_at: datetime
    updated_at: datetime


class MediaFolderCreate(CamelModel):
    name: str = Field(min_length=1, max_length=255)
    parent_id: str | None = None


class MediaFolderUpdate(CamelModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    parent_id: str | None = None


class MediaAssetOut(CamelModel):
    id: str
    organization_id: str
    folder_id: str | None
    name: str
    original_filename: str
    kind: str
    mime_type: str
    size_bytes: int
    storage_key: str
    url: str
    width: int | None = None
    height: int | None = None
    duration_seconds: float | None = None
    thumbnail_url: str | None = None
    poster_url: str | None = None
    trim_start_seconds: float | None = None
    trim_end_seconds: float | None = None
    crop_x: float | None = None
    crop_y: float | None = None
    crop_w: float | None = None
    crop_h: float | None = None
    muted: bool = True
    loop: bool = False
    tags: list[str]
    usage_count: int
    uploaded_by_user_id: str | None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime


class MediaAssetUpdate(CamelModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    kind: str | None = None
    folder_id: str | None = None
    tags: list[str] | None = None
    notes: str | None = None
    clear_folder: bool = False
    width: int | None = None
    height: int | None = None
    duration_seconds: float | None = None
    trim_start_seconds: float | None = None
    trim_end_seconds: float | None = None
    clear_trim: bool = False
    crop_x: float | None = None
    crop_y: float | None = None
    crop_w: float | None = None
    crop_h: float | None = None
    clear_crop: bool = False
    muted: bool | None = None
    loop: bool | None = None


class MediaProbeIn(CamelModel):
    width: int | None = None
    height: int | None = None
    duration_seconds: float | None = None


class MediaListOut(CamelModel):
    assets: list[MediaAssetOut]
    folders: list[MediaFolderOut]
    total: int


class MediaDownloadOut(CamelModel):
    url: str
    expires_in: int | None = None
