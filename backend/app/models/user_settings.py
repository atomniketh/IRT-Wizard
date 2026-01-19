from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base


class UserSettings(Base):
    __tablename__ = "user_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    default_competency_level: Mapped[str] = mapped_column(String(20), default="educator")
    default_model_type: Mapped[str] = mapped_column(String(10), default="2PL")
    theme: Mapped[str] = mapped_column(String(20), default="light")
    show_advanced_stats: Mapped[bool] = mapped_column(Boolean, default=False)
    settings: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
