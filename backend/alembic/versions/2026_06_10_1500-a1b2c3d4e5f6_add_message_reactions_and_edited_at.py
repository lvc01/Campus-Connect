"""Add message_reactions table and edited_at column to messages

Revision ID: a1b2c3d4e5f6
Revises: 5ba20b8d0fba
Create Date: 2026-06-10 15:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "a1b2c3d4e5f6"
down_revision = "5ba20b8d0fba"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("messages", sa.Column("edited_at", sa.DateTime(timezone=True), nullable=True))

    op.create_table(
        "message_reactions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("message_id", sa.Uuid(), sa.ForeignKey("messages.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("emoji", sa.String(10), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("message_id", "user_id", "emoji", name="uq_message_reaction"),
    )


def downgrade() -> None:
    op.drop_table("message_reactions")
    op.drop_column("messages", "edited_at")
