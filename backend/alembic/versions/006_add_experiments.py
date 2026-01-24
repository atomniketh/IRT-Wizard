"""Add experiments table for MLflow ownership tracking

Revision ID: 006
Revises: 005
Create Date: 2026-01-24

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "experiments",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("mlflow_experiment_id", sa.String(64), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.String(1000), nullable=True),
        sa.Column("owner_user_id", sa.UUID(), nullable=True),
        sa.Column("owner_organization_id", sa.UUID(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["owner_user_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["owner_organization_id"],
            ["organizations.id"],
            ondelete="CASCADE",
        ),
        sa.CheckConstraint(
            "(owner_user_id IS NOT NULL AND owner_organization_id IS NULL) OR "
            "(owner_user_id IS NULL AND owner_organization_id IS NOT NULL)",
            name="ck_experiment_owner_xor",
        ),
    )
    op.create_index(
        "ix_experiments_mlflow_experiment_id",
        "experiments",
        ["mlflow_experiment_id"],
        unique=True,
    )
    op.create_index(
        "ix_experiments_owner_user_id",
        "experiments",
        ["owner_user_id"],
    )
    op.create_index(
        "ix_experiments_owner_organization_id",
        "experiments",
        ["owner_organization_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_experiments_owner_organization_id", table_name="experiments")
    op.drop_index("ix_experiments_owner_user_id", table_name="experiments")
    op.drop_index("ix_experiments_mlflow_experiment_id", table_name="experiments")
    op.drop_table("experiments")
