"""Add audio_playlists, tracks, and screen background-audio fields."""

from typing import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260822_0012_audio"
down_revision: str | None = "20260822_0011_video"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "audio_playlists",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("organization_id", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column(
            "status", sa.String(length=16), nullable=False, server_default="draft"
        ),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("loop", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("volume", sa.Float(), nullable=False, server_default="0.5"),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by_user_id", sa.String(length=64), nullable=True),
        sa.Column("published_by_user_id", sa.String(length=64), nullable=True),
        sa.Column("published_snapshot", postgresql.JSONB(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"], ["organizations.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["created_by_user_id"], ["users.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["published_by_user_id"], ["users.id"], ondelete="SET NULL"
        ),
    )
    op.create_index(
        "ix_audio_playlists_organization_id", "audio_playlists", ["organization_id"]
    )
    op.create_index("ix_audio_playlists_status", "audio_playlists", ["status"])

    op.create_table(
        "audio_playlist_tracks",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("audio_playlist_id", sa.String(length=64), nullable=False),
        sa.Column("organization_id", sa.String(length=64), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("media_asset_id", sa.String(length=64), nullable=False),
        sa.Column("label", sa.String(length=255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["audio_playlist_id"], ["audio_playlists.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"], ["organizations.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["media_asset_id"], ["media_assets.id"], ondelete="CASCADE"
        ),
        sa.UniqueConstraint(
            "audio_playlist_id",
            "sort_order",
            name="uq_audio_playlist_track_order",
        ),
    )
    op.create_index(
        "ix_audio_playlist_tracks_audio_playlist_id",
        "audio_playlist_tracks",
        ["audio_playlist_id"],
    )
    op.create_index(
        "ix_audio_playlist_tracks_organization_id",
        "audio_playlist_tracks",
        ["organization_id"],
    )

    op.add_column(
        "screens",
        sa.Column("active_audio_playlist_id", sa.String(length=64), nullable=True),
    )
    op.create_foreign_key(
        "fk_screens_active_audio_playlist_id",
        "screens",
        "audio_playlists",
        ["active_audio_playlist_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.add_column(
        "screens",
        sa.Column(
            "audio_volume", sa.Float(), nullable=False, server_default="0.5"
        ),
    )
    op.add_column(
        "screens",
        sa.Column(
            "audio_muted", sa.Boolean(), nullable=False, server_default=sa.text("false")
        ),
    )
    op.add_column(
        "screens",
        sa.Column(
            "audio_loop", sa.Boolean(), nullable=False, server_default=sa.text("true")
        ),
    )


def downgrade() -> None:
    op.drop_column("screens", "audio_loop")
    op.drop_column("screens", "audio_muted")
    op.drop_column("screens", "audio_volume")
    op.drop_constraint(
        "fk_screens_active_audio_playlist_id", "screens", type_="foreignkey"
    )
    op.drop_column("screens", "active_audio_playlist_id")
    op.drop_index(
        "ix_audio_playlist_tracks_organization_id", table_name="audio_playlist_tracks"
    )
    op.drop_index(
        "ix_audio_playlist_tracks_audio_playlist_id",
        table_name="audio_playlist_tracks",
    )
    op.drop_table("audio_playlist_tracks")
    op.drop_index("ix_audio_playlists_status", table_name="audio_playlists")
    op.drop_index("ix_audio_playlists_organization_id", table_name="audio_playlists")
    op.drop_table("audio_playlists")
