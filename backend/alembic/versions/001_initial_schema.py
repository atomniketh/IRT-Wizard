"""Initial schema

Revision ID: 001
Revises:
Create Date: 2024-01-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'projects',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('competency_level', sa.String(20), server_default='educator', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table(
        'datasets',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('file_path', sa.String(500), nullable=True),
        sa.Column('original_filename', sa.String(255), nullable=True),
        sa.Column('file_size', sa.BigInteger(), nullable=True),
        sa.Column('row_count', sa.Integer(), nullable=True),
        sa.Column('column_count', sa.Integer(), nullable=True),
        sa.Column('item_names', postgresql.JSONB(), nullable=True),
        sa.Column('data_summary', postgresql.JSONB(), nullable=True),
        sa.Column('validation_status', sa.String(20), server_default='pending', nullable=False),
        sa.Column('validation_errors', postgresql.JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_datasets_project', 'datasets', ['project_id'])

    op.create_table(
        'analyses',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('dataset_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('name', sa.String(255), nullable=True),
        sa.Column('model_type', sa.String(10), nullable=False),
        sa.Column('status', sa.String(20), server_default='pending', nullable=False),
        sa.Column('config', postgresql.JSONB(), nullable=True),
        sa.Column('item_parameters', postgresql.JSONB(), nullable=True),
        sa.Column('ability_estimates', postgresql.JSONB(), nullable=True),
        sa.Column('model_fit', postgresql.JSONB(), nullable=True),
        sa.Column('mlflow_run_id', sa.String(50), nullable=True),
        sa.Column('mlflow_model_version', sa.Integer(), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['dataset_id'], ['datasets.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_analyses_project', 'analyses', ['project_id'])
    op.create_index('idx_analyses_status', 'analyses', ['status'])

    op.create_table(
        'user_settings',
        sa.Column('id', sa.Integer(), nullable=False, default=1),
        sa.Column('default_competency_level', sa.String(20), server_default='educator', nullable=False),
        sa.Column('default_model_type', sa.String(10), server_default='2PL', nullable=False),
        sa.Column('theme', sa.String(20), server_default='light', nullable=False),
        sa.Column('show_advanced_stats', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('settings', postgresql.JSONB(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('user_settings')
    op.drop_index('idx_analyses_status', table_name='analyses')
    op.drop_index('idx_analyses_project', table_name='analyses')
    op.drop_table('analyses')
    op.drop_index('idx_datasets_project', table_name='datasets')
    op.drop_table('datasets')
    op.drop_table('projects')
