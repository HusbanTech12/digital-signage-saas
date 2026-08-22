"""Add optional background audio playlist to themes for scheduling."""

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260822_0013_theme_audio"
down_revision: str | None = "20260822_0012_audio"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "themes",
        sa.Column("audio_playlist_id", sa.String(length=64), nullable=True),
    )
    op.create_foreign_key(
        "fk_themes_audio_playlist_id",
        "themes",
        "audio_playlists",
        ["audio_playlist_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_themes_audio_playlist_id", "themes", type_="foreignkey")
    op.drop_column("themes", "audio_playlist_id")
