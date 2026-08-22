"""Add playlists, playlist_items, and screens.active_playlist_id."""

from typing import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260822_0007_playlists"
down_revision: str | None = "20260822_0006_rich_items"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "playlists",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("organization_id", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column(
            "status", sa.String(length=16), nullable=False, server_default="draft"
        ),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("priority", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("loop", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by_user_id", sa.String(length=64), nullable=True),
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
    )
    op.create_index("ix_playlists_organization_id", "playlists", ["organization_id"])
    op.create_index("ix_playlists_status", "playlists", ["status"])

    op.create_table(
        "playlist_items",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("playlist_id", sa.String(length=64), nullable=False),
        sa.Column("organization_id", sa.String(length=64), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("content_type", sa.String(length=16), nullable=False),
        sa.Column(
            "duration_seconds", sa.Integer(), nullable=False, server_default="10"
        ),
        sa.Column("label", sa.String(length=255), nullable=True),
        sa.Column("menu_id", sa.String(length=64), nullable=True),
        sa.Column("template_id", sa.String(length=64), nullable=True),
        sa.Column("media_asset_id", sa.String(length=64), nullable=True),
        sa.Column("transition", sa.String(length=32), nullable=True),
        sa.Column(
            "meta",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
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
            ["playlist_id"], ["playlists.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"], ["organizations.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["menu_id"], ["menus.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(
            ["template_id"], ["templates.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["media_asset_id"], ["media_assets.id"], ondelete="SET NULL"
        ),
        sa.UniqueConstraint(
            "playlist_id", "sort_order", name="uq_playlist_item_order"
        ),
    )
    op.create_index(
        "ix_playlist_items_playlist_id", "playlist_items", ["playlist_id"]
    )
    op.create_index(
        "ix_playlist_items_organization_id", "playlist_items", ["organization_id"]
    )

    op.add_column(
        "screens",
        sa.Column("active_playlist_id", sa.String(length=64), nullable=True),
    )
    op.create_foreign_key(
        "fk_screens_active_playlist_id",
        "screens",
        "playlists",
        ["active_playlist_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_screens_active_playlist_id", "screens", type_="foreignkey")
    op.drop_column("screens", "active_playlist_id")
    op.drop_index("ix_playlist_items_organization_id", table_name="playlist_items")
    op.drop_index("ix_playlist_items_playlist_id", table_name="playlist_items")
    op.drop_table("playlist_items")
    op.drop_index("ix_playlists_status", table_name="playlists")
    op.drop_index("ix_playlists_organization_id", table_name="playlists")
    op.drop_table("playlists")
