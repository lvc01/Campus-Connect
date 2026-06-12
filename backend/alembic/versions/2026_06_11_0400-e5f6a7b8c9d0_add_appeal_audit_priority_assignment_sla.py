"""Add appeal, audit log, priority, assignment, SLA, is_hidden

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-06-11 04:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "e5f6a7b8c9d0"
down_revision = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # Create enum types
    conn.execute(sa.text("DROP TYPE IF EXISTS appeal_status CASCADE"))
    conn.execute(sa.text("DROP TYPE IF EXISTS report_priority CASCADE"))
    conn.execute(sa.text("CREATE TYPE report_priority AS ENUM ('low', 'medium', 'high', 'urgent')"))
    conn.execute(sa.text("CREATE TYPE appeal_status AS ENUM ('pending', 'approved', 'denied')"))

    # Report new columns via raw SQL
    conn.execute(sa.text("ALTER TABLE reports ADD COLUMN priority report_priority NOT NULL DEFAULT 'medium'"))
    conn.execute(sa.text("ALTER TABLE reports ADD COLUMN assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL"))
    conn.execute(sa.text("ALTER TABLE reports ADD COLUMN internal_notes TEXT"))
    conn.execute(sa.text("ALTER TABLE reports ADD COLUMN sla_deadline TIMESTAMPTZ"))
    conn.execute(sa.text("ALTER TABLE reports ADD COLUMN is_hidden BOOLEAN NOT NULL DEFAULT false"))

    # Post is_hidden
    conn.execute(sa.text("ALTER TABLE posts ADD COLUMN is_hidden BOOLEAN NOT NULL DEFAULT false"))

    # ReportAppeal table
    conn.execute(sa.text("""
        CREATE TABLE report_appeals (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
            reason TEXT NOT NULL,
            status appeal_status NOT NULL DEFAULT 'pending',
            reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
            review_note TEXT,
            reviewed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """))
    conn.execute(sa.text("CREATE INDEX idx_report_appeals_report_id ON report_appeals(report_id)"))

    # ModerationAuditLog table
    conn.execute(sa.text("""
        CREATE TABLE moderation_audit_log (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            moderator_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
            action VARCHAR(100) NOT NULL,
            target_type VARCHAR(50) NOT NULL,
            target_id VARCHAR(100) NOT NULL,
            details JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("DROP TABLE IF EXISTS moderation_audit_log"))
    conn.execute(sa.text("DROP TABLE IF EXISTS report_appeals"))
    conn.execute(sa.text("ALTER TABLE posts DROP COLUMN IF EXISTS is_hidden"))
    conn.execute(sa.text("ALTER TABLE reports DROP COLUMN IF EXISTS is_hidden"))
    conn.execute(sa.text("ALTER TABLE reports DROP COLUMN IF EXISTS sla_deadline"))
    conn.execute(sa.text("ALTER TABLE reports DROP COLUMN IF EXISTS internal_notes"))
    conn.execute(sa.text("ALTER TABLE reports DROP COLUMN IF EXISTS assigned_to"))
    conn.execute(sa.text("ALTER TABLE reports DROP COLUMN IF EXISTS priority"))
    conn.execute(sa.text("DROP TYPE IF EXISTS appeal_status"))
    conn.execute(sa.text("DROP TYPE IF EXISTS report_priority"))
