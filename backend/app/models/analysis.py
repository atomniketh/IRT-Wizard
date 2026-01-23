import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base

if TYPE_CHECKING:
    from app.models.dataset import Dataset
    from app.models.project import Project


class Analysis(Base):
    __tablename__ = "analyses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    dataset_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("datasets.id"), nullable=True
    )
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    model_type: Mapped[str] = mapped_column(String(10), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending")

    config: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    item_parameters: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    ability_estimates: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    model_fit: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    logs: Mapped[list[str] | None] = mapped_column(JSONB, nullable=True, default=list)

    mlflow_run_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    mlflow_model_version: Mapped[int | None] = mapped_column(Integer, nullable=True)

    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    project: Mapped["Project"] = relationship("Project", back_populates="analyses")
    dataset: Mapped["Dataset | None"] = relationship("Dataset")
