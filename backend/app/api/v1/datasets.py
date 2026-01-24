import io
import uuid
from typing import Any

import pandas as pd
from fastapi import APIRouter, File, HTTPException, UploadFile, status
from sqlalchemy import select

from app.api.deps import DbSession, SettingsDep
from app.models.dataset import Dataset
from app.schemas.dataset import DatasetRead, DatasetPreview, DatasetUploadResponse
from app.services.storage import StorageService
from app.utils.data_validation import validate_response_matrix

router = APIRouter()


@router.post("/upload", response_model=DatasetUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_dataset(
    project_id: uuid.UUID,
    file: UploadFile = File(...),
    db: DbSession = None,
    settings: SettingsDep = None,
) -> Dataset:
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    if not file.filename.lower().endswith((".csv", ".tsv", ".xls", ".xlsx", ".parquet")):
        raise HTTPException(status_code=400, detail="Only CSV, TSV, XLS, XLSX, and Parquet files are supported")

    content = await file.read()
    file_size = len(content)

    max_size = settings.max_upload_size_mb * 1024 * 1024
    if file_size > max_size:
        raise HTTPException(
            status_code=400, detail=f"File exceeds maximum size of {settings.max_upload_size_mb}MB"
        )

    try:
        filename_lower = file.filename.lower()
        if filename_lower.endswith(".parquet"):
            df = pd.read_parquet(io.BytesIO(content))
        elif filename_lower.endswith((".xls", ".xlsx")):
            df = pd.read_excel(io.BytesIO(content))
        elif filename_lower.endswith(".tsv"):
            df = pd.read_csv(io.BytesIO(content), sep="\t")
        else:
            df = pd.read_csv(io.BytesIO(content), sep=",")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")

    original_row_count = len(df)
    df = df.dropna(how='all')
    dropped_rows = original_row_count - len(df)

    validation_result = validate_response_matrix(df)

    if dropped_rows > 0:
        validation_result["errors"] = validation_result.get("errors") or []
        validation_result["errors"].append({
            "type": "empty_rows_removed",
            "message": f"{dropped_rows} empty row(s) were automatically removed from the dataset.",
        })

    cleaned_content = df.to_csv(index=False).encode('utf-8')
    storage = StorageService(settings)
    storage_filename = file.filename.rsplit('.', 1)[0] + '.csv' if not file.filename.lower().endswith('.csv') else file.filename
    file_path = await storage.upload_file(cleaned_content, storage_filename, str(project_id))

    item_names = list(df.columns)
    data_summary = {
        "mean_scores": df.mean().to_dict() if validation_result["is_valid"] else None,
        "item_counts": df.sum().to_dict() if validation_result["is_valid"] else None,
        "missing_count": df.isna().sum().to_dict(),
    }

    dataset = Dataset(
        project_id=project_id,
        name=file.filename,
        file_path=file_path,
        original_filename=file.filename,
        file_size=file_size,
        row_count=len(df),
        column_count=len(df.columns),
        item_names=item_names,
        data_summary=data_summary,
        validation_status="valid" if validation_result["is_valid"] else "invalid",
        validation_errors=validation_result.get("errors"),
        response_scale=validation_result.get("response_scale"),
        min_response=validation_result.get("min_response"),
        max_response=validation_result.get("max_response"),
        n_categories=validation_result.get("n_categories"),
        grouping_columns=validation_result.get("grouping_columns"),
    )
    db.add(dataset)
    await db.commit()
    await db.refresh(dataset)
    return dataset


@router.post("/from-url", response_model=DatasetUploadResponse, status_code=status.HTTP_201_CREATED)
async def fetch_dataset_from_url(
    project_id: uuid.UUID,
    url: str,
    db: DbSession = None,
    settings: SettingsDep = None,
) -> Dataset:
    import httpx

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, follow_redirects=True)
            response.raise_for_status()
            content = response.content
    except httpx.HTTPError as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch URL: {str(e)}")

    filename = url.split("/")[-1].split("?")[0]
    if not filename.lower().endswith((".csv", ".tsv", ".xls", ".xlsx", ".parquet")):
        filename = filename + ".csv"

    try:
        filename_lower = filename.lower()
        if filename_lower.endswith(".parquet"):
            df = pd.read_parquet(io.BytesIO(content))
        elif filename_lower.endswith((".xls", ".xlsx")):
            df = pd.read_excel(io.BytesIO(content))
        elif filename_lower.endswith(".tsv"):
            df = pd.read_csv(io.BytesIO(content), sep="\t")
        else:
            df = pd.read_csv(io.BytesIO(content), sep=",")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")

    original_row_count = len(df)
    df = df.dropna(how='all')
    dropped_rows = original_row_count - len(df)

    validation_result = validate_response_matrix(df)

    if dropped_rows > 0:
        validation_result["errors"] = validation_result.get("errors") or []
        validation_result["errors"].append({
            "type": "empty_rows_removed",
            "message": f"{dropped_rows} empty row(s) were automatically removed from the dataset.",
        })

    cleaned_content = df.to_csv(index=False).encode('utf-8')
    storage = StorageService(settings)
    storage_filename = filename.rsplit('.', 1)[0] + '.csv' if not filename.lower().endswith('.csv') else filename
    file_path = await storage.upload_file(cleaned_content, storage_filename, str(project_id))

    item_names = list(df.columns)
    data_summary = {
        "mean_scores": df.mean().to_dict() if validation_result["is_valid"] else None,
        "item_counts": df.sum().to_dict() if validation_result["is_valid"] else None,
        "missing_count": df.isna().sum().to_dict(),
    }

    dataset = Dataset(
        project_id=project_id,
        name=filename,
        file_path=file_path,
        original_filename=filename,
        file_size=len(content),
        row_count=len(df),
        column_count=len(df.columns),
        item_names=item_names,
        data_summary=data_summary,
        validation_status="valid" if validation_result["is_valid"] else "invalid",
        validation_errors=validation_result.get("errors"),
        response_scale=validation_result.get("response_scale"),
        min_response=validation_result.get("min_response"),
        max_response=validation_result.get("max_response"),
        n_categories=validation_result.get("n_categories"),
        grouping_columns=validation_result.get("grouping_columns"),
    )
    db.add(dataset)
    await db.commit()
    await db.refresh(dataset)
    return dataset


@router.get("/{dataset_id}", response_model=DatasetRead)
async def get_dataset(dataset_id: uuid.UUID, db: DbSession) -> Dataset:
    result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return dataset


@router.get("/{dataset_id}/preview", response_model=DatasetPreview)
async def preview_dataset(
    dataset_id: uuid.UUID,
    db: DbSession,
    settings: SettingsDep,
    rows: int = 10,
) -> dict[str, Any]:
    result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    if not dataset.file_path:
        raise HTTPException(status_code=400, detail="Dataset has no file")

    storage = StorageService(settings)
    content = await storage.download_file(dataset.file_path)

    separator = "\t" if dataset.original_filename and ".tsv" in dataset.original_filename else ","
    df = pd.read_csv(io.BytesIO(content), sep=separator, nrows=rows)

    return {
        "columns": list(df.columns),
        "rows": df.to_dict(orient="records"),
        "total_rows": dataset.row_count or 0,
        "total_columns": dataset.column_count or 0,
    }


@router.delete("/{dataset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_dataset(dataset_id: uuid.UUID, db: DbSession, settings: SettingsDep) -> None:
    result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    if dataset.file_path:
        storage = StorageService(settings)
        await storage.delete_file(dataset.file_path)

    await db.delete(dataset)
    await db.commit()
