from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base


class Screen(Base):
    __tablename__ = "screens"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    location_id: Mapped[str | None] = mapped_column(
        String(64), ForeignKey("locations.id", ondelete="SET NULL"), nullable=True, index=True
    )
    organization_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    device_token: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    pairing_code: Mapped[str | None] = mapped_column(String(16), nullable=True, index=True)
    last_heartbeat: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    resolution: Mapped[str] = mapped_column(String(32), nullable=False, default="1920x1080")
    orientation: Mapped[str] = mapped_column(String(16), nullable=False, default="landscape")
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pairing")
    active_menu_id: Mapped[str | None] = mapped_column(
        String(64), ForeignKey("menus.id", ondelete="SET NULL"), nullable=True
    )
    active_template_id: Mapped[str | None] = mapped_column(
        String(64), ForeignKey("templates.id", ondelete="SET NULL"), nullable=True
    )
    active_playlist_id: Mapped[str | None] = mapped_column(
        String(64), ForeignKey("playlists.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    location = relationship("Location", back_populates="screens")
