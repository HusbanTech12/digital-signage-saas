"""Add templates.resolution and orientation for LCD type targeting."""

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260821_0003_tpl_lcd"
down_revision: str | None = "20260820_0002_tpl_disp"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "templates",
        sa.Column(
            "resolution",
            sa.String(length=32),
            nullable=False,
            server_default="1920x1080",
        ),
    )
    op.add_column(
        "templates",
        sa.Column(
            "orientation",
            sa.String(length=16),
            nullable=False,
            server_default="landscape",
        ),
    )


def downgrade() -> None:
    op.drop_column("templates", "orientation")
    op.drop_column("templates", "resolution")
