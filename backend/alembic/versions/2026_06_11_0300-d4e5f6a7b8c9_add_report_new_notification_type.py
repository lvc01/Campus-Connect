"""Add report_new to notification_type enum

Revision ID: d4e5f6a7b8c9
Revises: c7d8e9f0a1b2
Create Date: 2026-06-11 03:00:00.000000
"""

from alembic import op

revision = "d4e5f6a7b8c9"
down_revision = "c7d8e9f0a1b2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'report_new'")


def downgrade() -> None:
    # PostgreSQL doesn't support removing enum values easily; skip
    pass
