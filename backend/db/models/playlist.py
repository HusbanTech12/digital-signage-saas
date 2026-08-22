from datetime import datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base

PLAYLIST_STATUSES = ("draft", "published", "archived")
PLAYLIST_CONTENT_TYPES = ("menu", "template", "image", "video")


class Playlist(Base):
    __tablename__ = "playlists"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    organization_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="draft", index=True
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    # Higher priority preferred when multiple schedules overlap (future).
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    loop: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_by_user_id: Mapped[str | None] = mapped_column(
        String(64), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    published_by_user_id: Mapped[str | None] = mapped_column(
        String(64), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    published_snapshot: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB, nullable=True
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

    items: Mapped[list["PlaylistItem"]] = relationship(
        "PlaylistItem",
        back_populates="playlist",
        cascade="all, delete-orphan",
        order_by="PlaylistItem.sort_order",
    )


class PlaylistItem(Base):
    __tablename__ = "playlist_items"
    __table_args__ = (
        UniqueConstraint("playlist_id", "sort_order", name="uq_playlist_item_order"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    playlist_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("playlists.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    organization_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    content_type: Mapped[str] = mapped_column(String(16), nullable=False)
    duration_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    label: Mapped[str | None] = mapped_column(String(255), nullable=True)
    menu_id: Mapped[str | None] = mapped_column(
        String(64), ForeignKey("menus.id", ondelete="SET NULL"), nullable=True
    )
    template_id: Mapped[str | None] = mapped_column(
        String(64), ForeignKey("templates.id", ondelete="SET NULL"), nullable=True
    )
    media_asset_id: Mapped[str | None] = mapped_column(
        String(64), ForeignKey("media_assets.id", ondelete="SET NULL"), nullable=True
    )
    # Optional per-slide transition override (fade, slide, …).
    transition: Mapped[str | None] = mapped_column(String(32), nullable=True)
    meta: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict, server_default="{}"
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

    playlist: Mapped["Playlist"] = relationship("Playlist", back_populates="items")
