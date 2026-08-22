"""Add content_versions + published snapshot fields on menus/templates/playlists."""

from typing import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260822_0008_versions"
down_revision: str | None = "20260822_0007_playlists"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "content_versions",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("organization_id", sa.String(length=64), nullable=False),
        sa.Column("entity_type", sa.String(length=16), nullable=False),
        sa.Column("entity_id", sa.String(length=64), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column(
            "status", sa.String(length=16), nullable=False, server_default="published"
        ),
        sa.Column("change_summary", sa.Text(), nullable=True),
        sa.Column(
            "snapshot",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("published_by_user_id", sa.String(length=64), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"], ["organizations.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["published_by_user_id"], ["users.id"], ondelete="SET NULL"
        ),
        sa.UniqueConstraint(
            "entity_type",
            "entity_id",
            "version",
            name="uq_content_version_entity_ver",
        ),
    )
    op.create_index(
        "ix_content_versions_organization_id", "content_versions", ["organization_id"]
    )
    op.create_index(
        "ix_content_versions_entity_type", "content_versions", ["entity_type"]
    )
    op.create_index(
        "ix_content_versions_entity_id", "content_versions", ["entity_id"]
    )
    op.create_index(
        "ix_content_versions_entity_lookup",
        "content_versions",
        ["entity_type", "entity_id"],
    )

    # Menus — draft/published/archived + published snapshot
    op.add_column(
        "menus",
        sa.Column(
            "status", sa.String(length=16), nullable=False, server_default="draft"
        ),
    )
    op.add_column(
        "menus",
        sa.Column("published_by_user_id", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "menus",
        sa.Column(
            "published_snapshot",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )
    op.create_foreign_key(
        "fk_menus_published_by_user_id",
        "menus",
        "users",
        ["published_by_user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_menus_status", "menus", ["status"])

    # Templates
    op.add_column(
        "templates",
        sa.Column(
            "status", sa.String(length=16), nullable=False, server_default="draft"
        ),
    )
    op.add_column(
        "templates",
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
    )
    op.add_column(
        "templates",
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "templates",
        sa.Column("published_by_user_id", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "templates",
        sa.Column(
            "published_snapshot",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )
    op.create_foreign_key(
        "fk_templates_published_by_user_id",
        "templates",
        "users",
        ["published_by_user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_templates_status", "templates", ["status"])

    # Playlists — published snapshot for kiosk-stable playback
    op.add_column(
        "playlists",
        sa.Column("published_by_user_id", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "playlists",
        sa.Column(
            "published_snapshot",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )
    op.create_foreign_key(
        "fk_playlists_published_by_user_id",
        "playlists",
        "users",
        ["published_by_user_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # Existing published menus → published status when published_at set
    op.execute(
        """
        UPDATE menus
        SET status = 'published'
        WHERE published_at IS NOT NULL
        """
    )


def downgrade() -> None:
    op.drop_constraint("fk_playlists_published_by_user_id", "playlists", type_="foreignkey")
    op.drop_column("playlists", "published_snapshot")
    op.drop_column("playlists", "published_by_user_id")

    op.drop_index("ix_templates_status", table_name="templates")
    op.drop_constraint("fk_templates_published_by_user_id", "templates", type_="foreignkey")
    op.drop_column("templates", "published_snapshot")
    op.drop_column("templates", "published_by_user_id")
    op.drop_column("templates", "published_at")
    op.drop_column("templates", "version")
    op.drop_column("templates", "status")

    op.drop_index("ix_menus_status", table_name="menus")
    op.drop_constraint("fk_menus_published_by_user_id", "menus", type_="foreignkey")
    op.drop_column("menus", "published_snapshot")
    op.drop_column("menus", "published_by_user_id")
    op.drop_column("menus", "status")

    op.drop_index("ix_content_versions_entity_lookup", table_name="content_versions")
    op.drop_index("ix_content_versions_entity_id", table_name="content_versions")
    op.drop_index("ix_content_versions_entity_type", table_name="content_versions")
    op.drop_index("ix_content_versions_organization_id", table_name="content_versions")
    op.drop_table("content_versions")
