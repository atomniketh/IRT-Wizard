"""Add grouping_columns to datasets for DIF analysis

Revision ID: 004
Revises: 003
Create Date: 2026-01-23

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


revision: str = '004'
down_revision: Union[str, None] = '003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('datasets', sa.Column('grouping_columns', JSONB, nullable=True))


def downgrade() -> None:
    op.drop_column('datasets', 'grouping_columns')
