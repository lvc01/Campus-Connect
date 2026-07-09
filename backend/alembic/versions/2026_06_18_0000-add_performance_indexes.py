"""Add performance indexes for feed, messaging, moderation, and search.

These indexes target the slow paths identified in the production-readiness
audit at ~30k users. Most are plain B-tree indexes (created with a brief
ACCESS EXCLUSIVE lock — fine for tables of this size). The one GIN trigram
index on ``messages.content`` serves message search; if this migration runs
against an already-large ``messages`` table, prefer running it with the
index built ``CONCURRENTLY`` out-of-band to avoid a long lock.

Index rationale:
  - ``posts(created_at DESC)``          — feed pagination cursor + newest-first sort
  - ``posts`` partial ``deleted_at IS NULL`` — almost every read filters soft-deletes
  - ``posts(club_id)``                  — club-feed filtering (``get_feed``)
  - ``conversation_members(user_id)``   — "my conversations" + unread counts
  - ``club_members(user_id)``           — "my clubs"
  - ``messages(content)`` GIN trigram   — message search (was a full scan)
  - ``notifications(user_id, created_at)`` + ``(user_id, is_read)`` — notification inbox
  - ``reports(status)``, ``(target_type, target_id)``, ``(reporter_id)`` — moderator queue
  - ``messages(sender_id)``             — unread-count GROUP BY filter
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c8d9e0f1a2b3"
down_revision: Union[str, None] = "f6a7b8c9d0e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Feed & posts ────────────────────────────────────────────────────
    op.create_index(
        "ix_posts_created_at",
        "posts",
        [sa.text("created_at DESC")],
    )
    # Partial index: the overwhelming majority of reads exclude soft-deleted
    # posts, so index only live rows — smaller, faster, always-used.
    op.create_index(
        "ix_posts_live_created_at",
        "posts",
        ["created_at"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index("ix_posts_club_id", "posts", ["club_id"])
    op.create_index("ix_posts_deleted_at", "posts", ["deleted_at"])

    # ── Messaging junction (queries filter on user_id, not conversation_id) ──
    op.create_index("ix_conversation_members_user_id", "conversation_members", ["user_id"])
    op.create_index("ix_messages_sender_id", "messages", ["sender_id"])

    # Message content search — trigram GIN for ``content ILIKE '%term%'``.
    # pg_trgm was created in revision 0002; ensure it exists here too.
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.create_index(
        "ix_messages_content_trgm",
        "messages",
        ["content"],
        postgresql_using="gin",
        postgresql_ops={"content": "gin_trgm_ops"},
    )

    # ── Clubs junction ──────────────────────────────────────────────────
    op.create_index("ix_club_members_user_id", "club_members", ["user_id"])

    # ── Notifications inbox ─────────────────────────────────────────────
    op.create_index(
        "ix_notifications_user_created",
        "notifications",
        ["user_id", sa.text("created_at DESC")],
    )
    op.create_index(
        "ix_notifications_user_unread",
        "notifications",
        ["user_id", "is_read"],
    )

    # ── Moderation queue ────────────────────────────────────────────────
    op.create_index("ix_reports_status", "reports", ["status"])
    op.create_index("ix_reports_priority", "reports", ["priority"])
    op.create_index("ix_reports_reporter", "reports", ["reporter_id"])
    op.create_index(
        "ix_reports_target",
        "reports",
        ["target_type", "target_id"],
    )
    op.create_index("ix_reports_assigned", "reports", ["assigned_to"])


def downgrade() -> None:
    op.drop_index("ix_reports_assigned", table_name="reports")
    op.drop_index("ix_reports_target", table_name="reports")
    op.drop_index("ix_reports_reporter", table_name="reports")
    op.drop_index("ix_reports_priority", table_name="reports")
    op.drop_index("ix_reports_status", table_name="reports")

    op.drop_index("ix_notifications_user_unread", table_name="notifications")
    op.drop_index("ix_notifications_user_created", table_name="notifications")

    op.drop_index("ix_club_members_user_id", table_name="club_members")

    op.drop_index("ix_messages_content_trgm", table_name="messages")
    op.drop_index("ix_messages_sender_id", table_name="messages")
    op.drop_index("ix_conversation_members_user_id", table_name="conversation_members")

    op.drop_index("ix_posts_deleted_at", table_name="posts")
    op.drop_index("ix_posts_club_id", table_name="posts")
    op.drop_index("ix_posts_live_created_at", table_name="posts")
    op.drop_index("ix_posts_created_at", table_name="posts")
