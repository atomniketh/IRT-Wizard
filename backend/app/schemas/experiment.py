from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ExperimentBase(BaseModel):
    name: str
    description: str | None = None


class ExperimentCreate(ExperimentBase):
    pass


class ExperimentUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class ExperimentResponse(ExperimentBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    mlflow_experiment_id: str
    owner_user_id: UUID | None = None
    owner_organization_id: UUID | None = None
    created_at: datetime
    updated_at: datetime


class ExperimentListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    mlflow_experiment_id: str
    name: str
    description: str | None = None
    owner_user_id: UUID | None = None
    owner_organization_id: UUID | None = None
    created_at: datetime


class ExperimentWithMLflow(ExperimentListItem):
    artifact_location: str | None = None
    lifecycle_stage: str | None = None
    tags: dict[str, str] = {}
    run_count: int = 0
    creation_time: int | None = None
    last_update_time: int | None = None
