"""QR codes for menus, promotions, ordering links, and custom destinations."""

from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base

QR_DESTINATION_TYPES = ("url", "menu", "promotion", "ordering", "text")
QR_ERROR_CORRECTIONS = ("L", "M", "Q", "H")
QR_MODULE_SHAPES = ("square", "rounded", "dot")
QR_EYE_SHAPES = ("square", "rounded", "circle")

#: Destinations that resolve to an HTTP target and can therefore be tracked.
QR_REDIRECT_TYPES = ("url", "promotion", "ordering")


class QrCode(Base):
    __tablename__ = "qr_codes"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    organization_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    location_id: Mapped[str | None] = mapped_column(
        String(64),
        ForeignKey("locations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    #: Public, unguessable slug used by the /q/<code> redirect and render URLs.
    short_code: Mapped[str] = mapped_column(
        String(24), nullable=False, unique=True, index=True
    )
    destination_type: Mapped[str] = mapped_column(
        String(16), nullable=False, default="url", index=True
    )
    target_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    menu_id: Mapped[str | None] = mapped_column(
        String(64), ForeignKey("menus.id", ondelete="SET NULL"), nullable=True
    )
    text_payload: Mapped[str | None] = mapped_column(Text, nullable=True)
    #: Route scans through the API so they can be counted (redirect types only).
    tracking_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )

    foreground_color: Mapped[str] = mapped_column(
        String(9), nullable=False, default="#000000"
    )
    background_color: Mapped[str] = mapped_column(
        String(16), nullable=False, default="#ffffff"
    )
    eye_color: Mapped[str | None] = mapped_column(String(9), nullable=True)
    module_shape: Mapped[str] = mapped_column(
        String(16), nullable=False, default="square"
    )
    eye_shape: Mapped[str] = mapped_column(
        String(16), nullable=False, default="square"
    )
    error_correction: Mapped[str] = mapped_column(
        String(1), nullable=False, default="M"
    )
    quiet_zone: Mapped[int] = mapped_column(Integer, nullable=False, default=4)
    logo_media_asset_id: Mapped[str | None] = mapped_column(
        String(64), ForeignKey("media_assets.id", ondelete="SET NULL"), nullable=True
    )
    logo_size_ratio: Mapped[float] = mapped_column(
        Float, nullable=False, default=0.22
    )
    caption: Mapped[str | None] = mapped_column(String(120), nullable=True)
    size_px: Mapped[int] = mapped_column(Integer, nullable=False, default=512)

    scan_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_scanned_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    created_by_user_id: Mapped[str | None] = mapped_column(
        String(64), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
