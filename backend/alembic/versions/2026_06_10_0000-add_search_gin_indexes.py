"""Add GIN trigram indexes for ILIKE search performance.

Enables the pg_trgm extension and adds GIN indexes on columns
used by the global search service, eliminating sequential scans
on ILIKE ``%term%`` queries.
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    op.create_index(
        "ix_profiles_display_name_trgm",
        "profiles",
        ["display_name"],
        postgresql_using="gin",
        postgresql_ops={"display_name": "gin_trgm_ops"},
    )
    op.create_index(
        "ix_posts_content_trgm",
        "posts",
        ["content"],
        postgresql_using="gin",
        postgresql_ops={"content": "gin_trgm_ops"},
    )
    op.create_index(
        "ix_clubs_name_trgm",
        "clubs",
        ["name"],
        postgresql_using="gin",
        postgresql_ops={"name": "gin_trgm_ops"},
    )
    op.create_index(
        "ix_clubs_description_trgm",
        "clubs",
        ["description"],
        postgresql_using="gin",
        postgresql_ops={"description": "gin_trgm_ops"},
    )
    op.create_index(
        "ix_events_title_trgm",
        "events",
        ["title"],
        postgresql_using="gin",
        postgresql_ops={"title": "gin_trgm_ops"},
    )
    op.create_index(
        "ix_events_description_trgm",
        "events",
        ["description"],
        postgresql_using="gin",
        postgresql_ops={"description": "gin_trgm_ops"},
    )
    op.create_index(
        "ix_marketplace_listings_title_trgm",
        "marketplace_listings",
        ["title"],
        postgresql_using="gin",
        postgresql_ops={"title": "gin_trgm_ops"},
    )


def downgrade() -> None:
    op.drop_index("ix_profiles_display_name_trgm", table_name="profiles")
    op.drop_index("ix_posts_content_trgm", table_name="posts")
    op.drop_index("ix_clubs_name_trgm", table_name="clubs")
    op.drop_index("ix_clubs_description_trgm", table_name="clubs")
    op.drop_index("ix_events_title_trgm", table_name="events")
    op.drop_index("ix_events_description_trgm", table_name="events")
    op.drop_index("ix_marketplace_listings_title_trgm", table_name="marketplace_listings")
    op.execute("DROP EXTENSION IF EXISTS pg_trgm")
