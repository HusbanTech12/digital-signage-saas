"""Add video editor fields on media_assets."""

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260822_0011_video"
down_revision: str | None = "20260822_0010_walls"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "media_assets",
        sa.Column("thumbnail_url", sa.String(length=2048), nullable=True),
    )
    op.add_column(
        "media_assets",
        sa.Column("poster_url", sa.String(length=2048), nullable=True),
    )
    op.add_column(
        "media_assets",
        sa.Column("trim_start_seconds", sa.Float(), nullable=True),
    )
    op.add_column(
        "media_assets",
        sa.Column("trim_end_seconds", sa.Float(), nullable=True),
    )
    op.add_column("media_assets", sa.Column("crop_x", sa.Float(), nullable=True))
    op.add_column("media_assets", sa.Column("crop_y", sa.Float(), nullable=True))
    op.add_column("media_assets", sa.Column("crop_w", sa.Float(), nullable=True))
    op.add_column("media_assets", sa.Column("crop_h", sa.Float(), nullable=True))
    op.add_column(
        "media_assets",
        sa.Column(
            "muted",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )
    op.add_column(
        "media_assets",
        sa.Column(
            "loop",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )


def downgrade() -> None:
    op.drop_column("media_assets", "loop")
    op.drop_column("media_assets", "muted")
    op.drop_column("media_assets", "crop_h")
    op.drop_column("media_assets", "crop_w")
    op.drop_column("media_assets", "crop_y")
    op.drop_column("media_assets", "crop_x")
    op.drop_column("media_assets", "trim_end_seconds")
    op.drop_column("media_assets", "trim_start_seconds")
    op.drop_column("media_assets", "poster_url")
    op.drop_column("media_assets", "thumbnail_url")
