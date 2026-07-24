"""Add location column to marketplace_listings

Revision ID: d3e4f5a6b7c8
Revises: b2c3d4e5f6a7
Create Date: 2026-06-21 01:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "d3e4f5a6b7c8"
down_revision = "b2c3d4e5f6a7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("marketplace_listings", sa.Column("location", sa.String(300), nullable=True))


def downgrade() -> None:
    op.drop_column("marketplace_listings", "location")
