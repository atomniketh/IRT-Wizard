"""Add response scale columns to datasets

Revision ID: 002
Revises: 001
Create Date: 2024-01-23

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '002'
down_revision: Union[str, None] = '001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('datasets', sa.Column('response_scale', sa.String(20), nullable=True))
    op.add_column('datasets', sa.Column('min_response', sa.Integer(), nullable=True))
    op.add_column('datasets', sa.Column('max_response', sa.Integer(), nullable=True))
    op.add_column('datasets', sa.Column('n_categories', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('datasets', 'n_categories')
    op.drop_column('datasets', 'max_response')
    op.drop_column('datasets', 'min_response')
    op.drop_column('datasets', 'response_scale')
