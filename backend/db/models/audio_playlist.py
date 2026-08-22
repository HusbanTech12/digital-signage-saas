"""Background music / audio playlists."""

from datetime import datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
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

AUDIO_PLAYLIST_STATUSES = ("draft", "published", "archived")


class AudioPlaylist(Base):
    __tablename__ = "audio_playlists"

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
    loop: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    volume: Mapped[float] = mapped_column(Float, nullable=False, default=0.5)
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

    tracks: Mapped[list["AudioPlaylistTrack"]] = relationship(
        "AudioPlaylistTrack",
        back_populates="audio_playlist",
        cascade="all, delete-orphan",
        order_by="AudioPlaylistTrack.sort_order",
    )


class AudioPlaylistTrack(Base):
    __tablename__ = "audio_playlist_tracks"
    __table_args__ = (
        UniqueConstraint(
            "audio_playlist_id", "sort_order", name="uq_audio_playlist_track_order"
        ),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    audio_playlist_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("audio_playlists.id", ondelete="CASCADE"),
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
    media_asset_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("media_assets.id", ondelete="CASCADE"),
        nullable=False,
    )
    label: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    audio_playlist: Mapped["AudioPlaylist"] = relationship(
        "AudioPlaylist", back_populates="tracks"
    )
