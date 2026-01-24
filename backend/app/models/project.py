import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base

if TYPE_CHECKING:
    from app.models.analysis import Analysis
    from app.models.dataset import Dataset
    from app.models.organization import Organization
    from app.models.user import User


class Project(Base):
    __tablename__ = "projects"
    __table_args__ = (
        CheckConstraint(
            "(owner_user_id IS NOT NULL AND owner_organization_id IS NULL) OR "
            "(owner_user_id IS NULL AND owner_organization_id IS NOT NULL)",
            name="ck_project_owner_xor",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    competency_level: Mapped[str] = mapped_column(String(20), default="educator")
    visibility: Mapped[str] = mapped_column(String(20), default="private", nullable=False)
    owner_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    owner_organization_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    owner_user: Mapped["User | None"] = relationship(
        "User",
        back_populates="owned_projects",
        foreign_keys=[owner_user_id],
    )
    owner_organization: Mapped["Organization | None"] = relationship(
        "Organization",
        back_populates="owned_projects",
        foreign_keys=[owner_organization_id],
    )
    datasets: Mapped[list["Dataset"]] = relationship(
        "Dataset", back_populates="project", cascade="all, delete-orphan"
    )
    analyses: Mapped[list["Analysis"]] = relationship(
        "Analysis", back_populates="project", cascade="all, delete-orphan"
    )
