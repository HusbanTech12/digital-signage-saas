from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import Field, field_validator

from app.schemas.common import CamelModel

QrDestinationType = Literal["url", "menu", "promotion", "ordering", "text"]
QrErrorCorrection = Literal["L", "M", "Q", "H"]
QrModuleShape = Literal["square", "rounded", "dot"]
QrEyeShape = Literal["square", "rounded", "circle"]

HEX_COLOR = r"^(#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{8})$"
BACKGROUND_COLOR = (
    r"^(#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{8}|transparent)$"
)


class QrCodeOut(CamelModel):
    id: str
    organization_id: str
    location_id: str | None
    name: str
    short_code: str
    destination_type: str
    target_url: str | None
    menu_id: str | None
    menu_name: str | None = None
    text_payload: str | None
    tracking_enabled: bool
    foreground_color: str
    background_color: str
    eye_color: str | None
    module_shape: str
    eye_shape: str
    error_correction: str
    quiet_zone: int
    logo_media_asset_id: str | None
    logo_url: str | None = None
    logo_size_ratio: float
    caption: str | None
    size_px: int
    scan_count: int
    last_scanned_at: datetime | None
    created_by_user_id: str | None
    created_at: datetime
    updated_at: datetime
    """Exact string encoded in the QR image."""
    encoded_value: str
    """Human-shareable link, or null for plain-text codes."""
    public_url: str | None
    """Unauthenticated render endpoints (usable in <img> and on kiosk screens)."""
    render_svg_url: str
    render_png_url: str


class QrCodeCreate(CamelModel):
    name: str = Field(min_length=1, max_length=255)
    destination_type: QrDestinationType = "url"
    target_url: str | None = Field(default=None, max_length=2048)
    menu_id: str | None = None
    text_payload: str | None = Field(default=None, max_length=1200)
    location_id: str | None = None
    tracking_enabled: bool = True
    foreground_color: str = Field(default="#000000", pattern=HEX_COLOR)
    background_color: str = Field(default="#ffffff", pattern=BACKGROUND_COLOR)
    eye_color: str | None = Field(default=None, pattern=HEX_COLOR)
    module_shape: QrModuleShape = "square"
    eye_shape: QrEyeShape = "square"
    error_correction: QrErrorCorrection = "M"
    quiet_zone: int = Field(default=4, ge=0, le=8)
    logo_media_asset_id: str | None = None
    logo_size_ratio: float = Field(default=0.22, ge=0.0, le=0.3)
    caption: str | None = Field(default=None, max_length=120)
    size_px: int = Field(default=512, ge=128, le=2048)


class QrCodeUpdate(CamelModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    destination_type: QrDestinationType | None = None
    target_url: str | None = Field(default=None, max_length=2048)
    menu_id: str | None = None
    text_payload: str | None = Field(default=None, max_length=1200)
    location_id: str | None = None
    clear_location: bool = False
    tracking_enabled: bool | None = None
    foreground_color: str | None = Field(default=None, pattern=HEX_COLOR)
    background_color: str | None = Field(default=None, pattern=BACKGROUND_COLOR)
    eye_color: str | None = Field(default=None, pattern=HEX_COLOR)
    clear_eye_color: bool = False
    module_shape: QrModuleShape | None = None
    eye_shape: QrEyeShape | None = None
    error_correction: QrErrorCorrection | None = None
    quiet_zone: int | None = Field(default=None, ge=0, le=8)
    logo_media_asset_id: str | None = None
    clear_logo: bool = False
    logo_size_ratio: float | None = Field(default=None, ge=0.0, le=0.3)
    caption: str | None = Field(default=None, max_length=120)
    size_px: int | None = Field(default=None, ge=128, le=2048)


class QrCodeListOut(CamelModel):
    qr_codes: list[QrCodeOut]
    total: int


class QrPreviewIn(CamelModel):
    """Render an unsaved draft so the editor can preview before committing."""

    destination_type: QrDestinationType = "url"
    target_url: str | None = Field(default=None, max_length=2048)
    menu_id: str | None = None
    text_payload: str | None = Field(default=None, max_length=1200)
    tracking_enabled: bool = True
    foreground_color: str = Field(default="#000000", pattern=HEX_COLOR)
    background_color: str = Field(default="#ffffff", pattern=BACKGROUND_COLOR)
    eye_color: str | None = Field(default=None, pattern=HEX_COLOR)
    module_shape: QrModuleShape = "square"
    eye_shape: QrEyeShape = "square"
    error_correction: QrErrorCorrection = "M"
    quiet_zone: int = Field(default=4, ge=0, le=8)
    logo_media_asset_id: str | None = None
    logo_size_ratio: float = Field(default=0.22, ge=0.0, le=0.3)
    caption: str | None = Field(default=None, max_length=120)


class QrPreviewOut(CamelModel):
    svg: str
    encoded_value: str


class QrPublicMenuItemOut(CamelModel):
    id: str
    name: str
    price: float
    description: str
    image_url: str | None
    available: bool
    category: str
    sort_order: int

    @field_validator("price", mode="before")
    @classmethod
    def _price_to_float(cls, value: object) -> float:
        if isinstance(value, Decimal):
            return float(value)
        return float(value)  # type: ignore[arg-type]


class QrPublicMenuOut(CamelModel):
    id: str
    name: str
    version: int
    organization_name: str
    items: list[QrPublicMenuItemOut]


class QrPublicResolveOut(CamelModel):
    """Public payload for a scanned code — no tenant internals exposed."""

    short_code: str
    name: str
    destination_type: str
    caption: str | None
    redirect_url: str | None = None
    menu: QrPublicMenuOut | None = None
