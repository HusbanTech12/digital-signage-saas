"""Placeholder for rich menu items revision stamped in some environments.

No schema changes — keeps alembic history aligned when this revision was
recorded without a migration file present in the repo.
"""

from typing import Sequence

revision: str = "20260822_0006_rich_items"
down_revision: str | None = "20260822_0005_media"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
