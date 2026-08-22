"""Screen groups for multi-screen / video wall layouts."""

from datetime import datetime

from sqlalchemy import (
    BigInteger,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base

SCREEN_GROUP_LAYOUTS = ("2x2", "3x3", "4x4", "custom")
SCREEN_GROUP_CONTENT_MODES = ("shared", "tiled")


class ScreenGroup(Base):
    __tablename__ = "screen_groups"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    organization_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    location_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("locations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    layout: Mapped[str] = mapped_column(String(16), nullable=False, default="2x2")
    rows: Mapped[int] = mapped_column(Integer, nullable=False, default=2)
    cols: Mapped[int] = mapped_column(Integer, nullable=False, default=2)
    content_mode: Mapped[str] = mapped_column(
        String(16), nullable=False, default="shared"
    )
    active_menu_id: Mapped[str | None] = mapped_column(
        String(64), ForeignKey("menus.id", ondelete="SET NULL"), nullable=True
    )
    active_template_id: Mapped[str | None] = mapped_column(
        String(64), ForeignKey("templates.id", ondelete="SET NULL"), nullable=True
    )
    active_playlist_id: Mapped[str | None] = mapped_column(
        String(64), ForeignKey("playlists.id", ondelete="SET NULL"), nullable=True
    )
    sync_epoch_ms: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    bezel_compensation_pct: Mapped[float] = mapped_column(
        Float, nullable=False, default=0.0
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

    members: Mapped[list["ScreenGroupMember"]] = relationship(
        "ScreenGroupMember",
        back_populates="screen_group",
        cascade="all, delete-orphan",
        order_by="ScreenGroupMember.row_index, ScreenGroupMember.col_index",
    )


class ScreenGroupMember(Base):
    __tablename__ = "screen_group_members"
    __table_args__ = (
        UniqueConstraint("screen_id", name="uq_screen_group_member_screen"),
        UniqueConstraint(
            "screen_group_id",
            "row_index",
            "col_index",
            name="uq_screen_group_member_cell",
        ),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    screen_group_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("screen_groups.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    screen_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("screens.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    organization_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    row_index: Mapped[int] = mapped_column(Integer, nullable=False)
    col_index: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    screen_group: Mapped["ScreenGroup"] = relationship(
        "ScreenGroup", back_populates="members"
    )
