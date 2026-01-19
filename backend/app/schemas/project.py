import uuid
from datetime import datetime

from pydantic import BaseModel

from app.schemas.irt import CompetencyLevel


class ProjectBase(BaseModel):
    name: str
    description: str | None = None
    competency_level: CompetencyLevel = CompetencyLevel.EDUCATOR


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    competency_level: CompetencyLevel | None = None


class ProjectRead(ProjectBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
