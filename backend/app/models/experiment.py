from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base

if TYPE_CHECKING:
    from app.models.organization import Organization
    from app.models.user import User


class Experiment(Base):
    __tablename__ = "experiments"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    mlflow_experiment_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    owner_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=True
    )
    owner_organization_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    owner_user: Mapped["User | None"] = relationship(back_populates="experiments")
    owner_organization: Mapped["Organization | None"] = relationship(
        back_populates="experiments"
    )

    __table_args__ = (
        CheckConstraint(
            "(owner_user_id IS NOT NULL AND owner_organization_id IS NULL) OR "
            "(owner_user_id IS NULL AND owner_organization_id IS NOT NULL)",
            name="ck_experiment_owner_xor",
        ),
        Index("ix_experiments_owner_user_id", "owner_user_id"),
        Index("ix_experiments_owner_organization_id", "owner_organization_id"),
    )
