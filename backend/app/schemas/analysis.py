import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel

from app.schemas.irt import ItemParameter, AbilityEstimate, ModelFitStatistics, ModelType


class AnalysisConfig(BaseModel):
    estimation_method: str = "MML"
    max_iterations: int = 1000
    convergence_threshold: float = 0.0001
    ability_estimation_method: str = "EAP"


class AnalysisCreate(BaseModel):
    project_id: uuid.UUID
    dataset_id: uuid.UUID
    name: str | None = None
    model_type: ModelType
    config: AnalysisConfig | None = None


class AnalysisStatus(BaseModel):
    id: uuid.UUID
    status: str
    progress: float | None = None
    message: str | None = None


class AnalysisResults(BaseModel):
    item_parameters: list[ItemParameter]
    ability_estimates: list[AbilityEstimate]
    model_fit: ModelFitStatistics


class AnalysisRead(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    dataset_id: uuid.UUID | None = None
    name: str | None = None
    model_type: ModelType
    status: str
    config: dict[str, Any] | None = None
    item_parameters: dict[str, Any] | None = None
    ability_estimates: dict[str, Any] | None = None
    model_fit: dict[str, Any] | None = None
    mlflow_run_id: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    error_message: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True
