"""QR code generator: destinations, styling, logo, and scan tracking."""

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260828_0015_qr_codes"
down_revision: str | None = "20260823_0014_tpl_hub"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "qr_codes",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("organization_id", sa.String(length=64), nullable=False),
        sa.Column("location_id", sa.String(length=64), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("short_code", sa.String(length=24), nullable=False),
        sa.Column(
            "destination_type",
            sa.String(length=16),
            nullable=False,
            server_default="url",
        ),
        sa.Column("target_url", sa.String(length=2048), nullable=True),
        sa.Column("menu_id", sa.String(length=64), nullable=True),
        sa.Column("text_payload", sa.Text(), nullable=True),
        sa.Column(
            "tracking_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "foreground_color",
            sa.String(length=9),
            nullable=False,
            server_default="#000000",
        ),
        sa.Column(
            "background_color",
            sa.String(length=16),
            nullable=False,
            server_default="#ffffff",
        ),
        sa.Column("eye_color", sa.String(length=9), nullable=True),
        sa.Column(
            "module_shape",
            sa.String(length=16),
            nullable=False,
            server_default="square",
        ),
        sa.Column(
            "eye_shape",
            sa.String(length=16),
            nullable=False,
            server_default="square",
        ),
        sa.Column(
            "error_correction",
            sa.String(length=1),
            nullable=False,
            server_default="M",
        ),
        sa.Column("quiet_zone", sa.Integer(), nullable=False, server_default="4"),
        sa.Column("logo_media_asset_id", sa.String(length=64), nullable=True),
        sa.Column(
            "logo_size_ratio", sa.Float(), nullable=False, server_default="0.22"
        ),
        sa.Column("caption", sa.String(length=120), nullable=True),
        sa.Column("size_px", sa.Integer(), nullable=False, server_default="512"),
        sa.Column("scan_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_scanned_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by_user_id", sa.String(length=64), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"], ["organizations.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["location_id"], ["locations.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["menu_id"], ["menus.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(
            ["logo_media_asset_id"], ["media_assets.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["created_by_user_id"], ["users.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_qr_codes_organization_id", "qr_codes", ["organization_id"])
    op.create_index("ix_qr_codes_location_id", "qr_codes", ["location_id"])
    op.create_index("ix_qr_codes_destination_type", "qr_codes", ["destination_type"])
    op.create_index("ix_qr_codes_short_code", "qr_codes", ["short_code"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_qr_codes_short_code", table_name="qr_codes")
    op.drop_index("ix_qr_codes_destination_type", table_name="qr_codes")
    op.drop_index("ix_qr_codes_location_id", table_name="qr_codes")
    op.drop_index("ix_qr_codes_organization_id", table_name="qr_codes")
    op.drop_table("qr_codes")
