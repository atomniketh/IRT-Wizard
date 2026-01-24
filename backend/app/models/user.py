import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base

if TYPE_CHECKING:
    from app.models.organization_membership import OrganizationMembership
    from app.models.project import Project


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    external_id: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    auth_provider: Mapped[str] = mapped_column(String(50), nullable=False, default="dev")
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    memberships: Mapped[list["OrganizationMembership"]] = relationship(
        "OrganizationMembership",
        back_populates="user",
        cascade="all, delete-orphan",
        foreign_keys="OrganizationMembership.user_id",
    )
    owned_projects: Mapped[list["Project"]] = relationship(
        "Project",
        back_populates="owner_user",
        foreign_keys="Project.owner_user_id",
    )
    sent_invitations: Mapped[list["OrganizationMembership"]] = relationship(
        "OrganizationMembership",
        foreign_keys="OrganizationMembership.invited_by_id",
    )
