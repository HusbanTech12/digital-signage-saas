"""Add advanced device management fields on screens."""

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260822_0009_device"
down_revision: str | None = "20260822_0008_versions"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "screens",
        sa.Column("last_sync_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "screens",
        sa.Column("last_error", sa.Text(), nullable=True),
    )
    op.add_column(
        "screens",
        sa.Column("last_error_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "screens",
        sa.Column("content_version", sa.Integer(), nullable=True),
    )
    op.add_column(
        "screens",
        sa.Column("content_updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "screens",
        sa.Column("current_content_summary", sa.String(length=512), nullable=True),
    )
    op.add_column(
        "screens",
        sa.Column("client_app_version", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "screens",
        sa.Column("pending_command", sa.String(length=32), nullable=True),
    )
    op.add_column(
        "screens",
        sa.Column("pending_command_id", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "screens",
        sa.Column("pending_command_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "screens",
        sa.Column("pairing_expires_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("screens", "pairing_expires_at")
    op.drop_column("screens", "pending_command_at")
    op.drop_column("screens", "pending_command_id")
    op.drop_column("screens", "pending_command")
    op.drop_column("screens", "client_app_version")
    op.drop_column("screens", "current_content_summary")
    op.drop_column("screens", "content_updated_at")
    op.drop_column("screens", "content_version")
    op.drop_column("screens", "last_error_at")
    op.drop_column("screens", "last_error")
    op.drop_column("screens", "last_sync_at")
