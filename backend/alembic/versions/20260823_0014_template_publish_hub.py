"""Store template package defaults: audio playlist, visual playlist, playback."""

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260823_0014_tpl_hub"
down_revision: str | None = "20260822_0013_theme_audio"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "templates",
        sa.Column("audio_playlist_id", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "templates",
        sa.Column(
            "audio_volume",
            sa.Float(),
            nullable=False,
            server_default="0.5",
        ),
    )
    op.add_column(
        "templates",
        sa.Column(
            "audio_loop",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )
    op.add_column(
        "templates",
        sa.Column(
            "audio_muted",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "templates",
        sa.Column("playlist_id", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "templates",
        sa.Column("playlist_item_duration_seconds", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_templates_audio_playlist_id",
        "templates",
        "audio_playlists",
        ["audio_playlist_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_templates_playlist_id",
        "templates",
        "playlists",
        ["playlist_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_templates_playlist_id", "templates", type_="foreignkey")
    op.drop_constraint("fk_templates_audio_playlist_id", "templates", type_="foreignkey")
    op.drop_column("templates", "playlist_item_duration_seconds")
    op.drop_column("templates", "playlist_id")
    op.drop_column("templates", "audio_muted")
    op.drop_column("templates", "audio_loop")
    op.drop_column("templates", "audio_volume")
    op.drop_column("templates", "audio_playlist_id")
