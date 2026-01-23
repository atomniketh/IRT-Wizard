"""Add logs column to analyses table

Revision ID: 003
Revises: 002
Create Date: 2026-01-23
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("analyses", sa.Column("logs", JSONB, nullable=True, server_default="[]"))


def downgrade() -> None:
    op.drop_column("analyses", "logs")
