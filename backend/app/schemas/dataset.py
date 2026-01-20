import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel


class DatasetBase(BaseModel):
    name: str


class DatasetCreate(DatasetBase):
    project_id: uuid.UUID


class DatasetRead(DatasetBase):
    id: uuid.UUID
    project_id: uuid.UUID
    file_path: str | None = None
    original_filename: str | None = None
    file_size: int | None = None
    row_count: int | None = None
    column_count: int | None = None
    item_names: list[str] | None = None
    data_summary: dict[str, Any] | None = None
    validation_status: str
    validation_errors: list[dict[str, Any]] | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class DatasetPreview(BaseModel):
    columns: list[str]
    rows: list[dict[str, Any]]
    total_rows: int
    total_columns: int


class DatasetUploadResponse(BaseModel):
    id: uuid.UUID
    name: str
    original_filename: str
    file_size: int
    row_count: int
    column_count: int
    item_names: list[str]
    validation_status: str
    validation_errors: list[dict[str, Any]] | None = None

    class Config:
        from_attributes = True
