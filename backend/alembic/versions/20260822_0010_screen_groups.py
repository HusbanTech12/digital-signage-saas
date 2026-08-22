"""Add screen_groups and screen_group_members for video wall sync."""

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260822_0010_walls"
down_revision: str | None = "20260822_0009_device"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "screen_groups",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("organization_id", sa.String(length=64), nullable=False),
        sa.Column("location_id", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("layout", sa.String(length=16), nullable=False, server_default="2x2"),
        sa.Column("rows", sa.Integer(), nullable=False, server_default="2"),
        sa.Column("cols", sa.Integer(), nullable=False, server_default="2"),
        sa.Column(
            "content_mode",
            sa.String(length=16),
            nullable=False,
            server_default="shared",
        ),
        sa.Column("active_menu_id", sa.String(length=64), nullable=True),
        sa.Column("active_template_id", sa.String(length=64), nullable=True),
        sa.Column("active_playlist_id", sa.String(length=64), nullable=True),
        sa.Column("sync_epoch_ms", sa.BigInteger(), nullable=True),
        sa.Column(
            "bezel_compensation_pct",
            sa.Float(),
            nullable=False,
            server_default="0",
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
            ["organization_id"], ["organizations.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["location_id"], ["locations.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["active_menu_id"], ["menus.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(
            ["active_template_id"], ["templates.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["active_playlist_id"], ["playlists.id"], ondelete="SET NULL"
        ),
    )
    op.create_index(
        "ix_screen_groups_organization_id", "screen_groups", ["organization_id"]
    )
    op.create_index("ix_screen_groups_location_id", "screen_groups", ["location_id"])

    op.create_table(
        "screen_group_members",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("screen_group_id", sa.String(length=64), nullable=False),
        sa.Column("screen_id", sa.String(length=64), nullable=False),
        sa.Column("organization_id", sa.String(length=64), nullable=False),
        sa.Column("row_index", sa.Integer(), nullable=False),
        sa.Column("col_index", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["screen_group_id"], ["screen_groups.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["screen_id"], ["screens.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["organization_id"], ["organizations.id"], ondelete="CASCADE"
        ),
        sa.UniqueConstraint("screen_id", name="uq_screen_group_member_screen"),
        sa.UniqueConstraint(
            "screen_group_id",
            "row_index",
            "col_index",
            name="uq_screen_group_member_cell",
        ),
    )
    op.create_index(
        "ix_screen_group_members_screen_group_id",
        "screen_group_members",
        ["screen_group_id"],
    )
    op.create_index(
        "ix_screen_group_members_screen_id", "screen_group_members", ["screen_id"]
    )
    op.create_index(
        "ix_screen_group_members_organization_id",
        "screen_group_members",
        ["organization_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_screen_group_members_organization_id", table_name="screen_group_members"
    )
    op.drop_index("ix_screen_group_members_screen_id", table_name="screen_group_members")
    op.drop_index(
        "ix_screen_group_members_screen_group_id", table_name="screen_group_members"
    )
    op.drop_table("screen_group_members")
    op.drop_index("ix_screen_groups_location_id", table_name="screen_groups")
    op.drop_index("ix_screen_groups_organization_id", table_name="screen_groups")
    op.drop_table("screen_groups")
