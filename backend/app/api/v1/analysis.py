import io
import uuid
from datetime import datetime
from typing import Any

import numpy as np
import pandas as pd
from fastapi import APIRouter, BackgroundTasks, HTTPException, status
from sqlalchemy import select

from app.api.deps import DbSession, SettingsDep
from app.core.irt_engine import fit_model, ModelType as IRTModelType
from app.models.analysis import Analysis
from app.models.dataset import Dataset
from app.schemas.analysis import AnalysisCreate, AnalysisRead, AnalysisStatus
from app.schemas.irt import ICCCurve, ItemInformationFunction, TestInformationFunction

router = APIRouter()


async def run_analysis_task(
    analysis_id: uuid.UUID,
    dataset_id: uuid.UUID,
    model_type: str,
    config: dict[str, Any] | None,
    db_url: str,
    s3_settings: dict[str, str],
    mlflow_tracking_uri: str,
) -> None:
    import mlflow
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session

    mlflow.set_tracking_uri(mlflow_tracking_uri)

    engine = create_engine(db_url.replace("+asyncpg", ""))

    with Session(engine) as session:
        analysis = session.get(Analysis, analysis_id)
        dataset = session.get(Dataset, dataset_id)

        if not analysis or not dataset:
            return

        analysis.status = "running"
        analysis.started_at = datetime.utcnow()
        session.commit()

        try:
            import boto3
            from botocore.config import Config

            s3_client = boto3.client(
                "s3",
                endpoint_url=s3_settings["endpoint"],
                aws_access_key_id=s3_settings["access_key"],
                aws_secret_access_key=s3_settings["secret_key"],
                config=Config(signature_version="s3v4"),
            )

            response = s3_client.get_object(Bucket=s3_settings["bucket"], Key=dataset.file_path)
            content = response["Body"].read()

            separator = (
                "\t"
                if dataset.original_filename and ".tsv" in dataset.original_filename
                else ","
            )
            df = pd.read_csv(io.BytesIO(content), sep=separator)

            binary_columns = []
            for col in df.columns:
                unique_vals = df[col].dropna().unique()
                if all(v in [0, 1, 0.0, 1.0] for v in unique_vals):
                    binary_columns.append(col)

            if len(binary_columns) < 2:
                raise ValueError(f"Need at least 2 binary columns, found {len(binary_columns)}")

            item_df = df[binary_columns]
            data = item_df.values
            data = np.nan_to_num(data, nan=0).astype(int)

            irt_model_type = IRTModelType(model_type)

            experiment = mlflow.get_experiment_by_name("IRT-Analyses")
            if experiment is None:
                mlflow.create_experiment(
                    "IRT-Analyses",
                    tags={
                        "mlflow.note.content": "Item Response Theory model fitting experiments. Tracks 1PL, 2PL, and 3PL model runs with item parameters, fit statistics, and standard errors."
                    }
                )
            mlflow.set_experiment("IRT-Analyses")
            with mlflow.start_run(run_name=f"{model_type}_{analysis_id}") as run:
                mlflow.set_tag("mlflow.note.content", f"{model_type} IRT model analysis on {dataset.original_filename or dataset.name}")
                mlflow.log_param("model_type", model_type)
                mlflow.log_param("dataset_id", str(dataset_id))
                mlflow.log_param("dataset_name", dataset.original_filename or dataset.name)
                mlflow.log_param("n_items", len(binary_columns))
                mlflow.log_param("n_persons", len(data))
                if config:
                    for key, value in config.items():
                        mlflow.log_param(f"config_{key}", value)

                result = fit_model(
                    data=data,
                    model_type=irt_model_type,
                    item_names=binary_columns,
                )

                mlflow.log_metric("aic", result.model_fit["aic"])
                mlflow.log_metric("bic", result.model_fit["bic"])
                mlflow.log_metric("log_likelihood", result.model_fit["log_likelihood"])
                mlflow.log_metric("n_parameters", result.model_fit["n_parameters"])
                mlflow.log_metric("converged", 1 if result.converged else 0)

                mean_difficulty = float(np.mean(result.item_parameters.difficulty))
                mean_discrimination = float(np.mean(result.item_parameters.discrimination))
                mlflow.log_metric("mean_difficulty", mean_difficulty)
                mlflow.log_metric("mean_discrimination", mean_discrimination)

                if result.item_parameters.se_difficulty is not None:
                    mean_se_difficulty = float(np.mean(result.item_parameters.se_difficulty))
                    mlflow.log_metric("mean_se_difficulty", mean_se_difficulty)
                if result.item_parameters.se_discrimination is not None:
                    mean_se_discrimination = float(np.mean(result.item_parameters.se_discrimination))
                    mlflow.log_metric("mean_se_discrimination", mean_se_discrimination)

                analysis.mlflow_run_id = run.info.run_id

            analysis.item_parameters = {
                "items": [
                    {
                        "name": result.item_parameters.names[i],
                        "difficulty": float(result.item_parameters.difficulty[i]),
                        "discrimination": float(result.item_parameters.discrimination[i]),
                        "guessing": float(result.item_parameters.guessing[i]),
                        "se_difficulty": (
                            float(result.item_parameters.se_difficulty[i])
                            if result.item_parameters.se_difficulty is not None
                            else None
                        ),
                        "se_discrimination": (
                            float(result.item_parameters.se_discrimination[i])
                            if result.item_parameters.se_discrimination is not None
                            else None
                        ),
                    }
                    for i in range(len(result.item_parameters.names))
                ]
            }

            analysis.ability_estimates = {
                "persons": [
                    {
                        "id": result.abilities.person_ids[i],
                        "theta": float(result.abilities.theta[i]),
                        "se": (
                            float(result.abilities.se_theta[i])
                            if result.abilities.se_theta is not None
                            else None
                        ),
                    }
                    for i in range(len(result.abilities.person_ids))
                ]
            }

            analysis.model_fit = result.model_fit
            analysis.status = "completed"
            analysis.completed_at = datetime.utcnow()

        except Exception as e:
            analysis.status = "failed"
            analysis.error_message = str(e)
            analysis.completed_at = datetime.utcnow()

        session.commit()


@router.post("", response_model=AnalysisRead, status_code=status.HTTP_201_CREATED)
async def create_analysis(
    analysis_in: AnalysisCreate,
    background_tasks: BackgroundTasks,
    db: DbSession,
    settings: SettingsDep,
) -> Analysis:
    result = await db.execute(select(Dataset).where(Dataset.id == analysis_in.dataset_id))
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    if dataset.validation_status != "valid":
        raise HTTPException(status_code=400, detail="Dataset is not valid for analysis")

    analysis = Analysis(
        project_id=analysis_in.project_id,
        dataset_id=analysis_in.dataset_id,
        name=analysis_in.name or f"{analysis_in.model_type.value} Analysis",
        model_type=analysis_in.model_type.value,
        config=analysis_in.config.model_dump() if analysis_in.config else None,
        status="pending",
    )
    db.add(analysis)
    await db.commit()
    await db.refresh(analysis)

    s3_settings = {
        "endpoint": settings.s3_endpoint_url,
        "access_key": settings.s3_access_key,
        "secret_key": settings.s3_secret_key,
        "bucket": settings.s3_bucket,
    }

    background_tasks.add_task(
        run_analysis_task,
        analysis.id,
        dataset.id,
        analysis.model_type,
        analysis.config,
        settings.database_url,
        s3_settings,
        settings.mlflow_tracking_uri,
    )

    return analysis


@router.get("/{analysis_id}", response_model=AnalysisRead)
async def get_analysis(analysis_id: uuid.UUID, db: DbSession) -> Analysis:
    result = await db.execute(select(Analysis).where(Analysis.id == analysis_id))
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return analysis


@router.get("/{analysis_id}/status", response_model=AnalysisStatus)
async def get_analysis_status(analysis_id: uuid.UUID, db: DbSession) -> dict[str, Any]:
    result = await db.execute(select(Analysis).where(Analysis.id == analysis_id))
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    return {
        "id": analysis.id,
        "status": analysis.status,
        "progress": None,
        "message": analysis.error_message if analysis.status == "failed" else None,
    }


@router.get("/{analysis_id}/item-parameters")
async def get_item_parameters(analysis_id: uuid.UUID, db: DbSession) -> dict[str, Any]:
    result = await db.execute(select(Analysis).where(Analysis.id == analysis_id))
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    if analysis.status != "completed":
        raise HTTPException(status_code=400, detail="Analysis not completed")

    return analysis.item_parameters or {}


@router.get("/{analysis_id}/abilities")
async def get_ability_estimates(analysis_id: uuid.UUID, db: DbSession) -> dict[str, Any]:
    result = await db.execute(select(Analysis).where(Analysis.id == analysis_id))
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    if analysis.status != "completed":
        raise HTTPException(status_code=400, detail="Analysis not completed")

    return analysis.ability_estimates or {}


@router.get("/{analysis_id}/fit-statistics")
async def get_fit_statistics(analysis_id: uuid.UUID, db: DbSession) -> dict[str, Any]:
    result = await db.execute(select(Analysis).where(Analysis.id == analysis_id))
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    if analysis.status != "completed":
        raise HTTPException(status_code=400, detail="Analysis not completed")

    return analysis.model_fit or {}


@router.get("/{analysis_id}/icc-data", response_model=list[ICCCurve])
async def get_icc_data(analysis_id: uuid.UUID, db: DbSession) -> list[dict[str, Any]]:
    from app.core.irt_engine import compute_icc_data

    result = await db.execute(select(Analysis).where(Analysis.id == analysis_id))
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    if analysis.status != "completed" or not analysis.item_parameters:
        raise HTTPException(status_code=400, detail="Analysis not completed")

    return compute_icc_data(analysis.item_parameters, IRTModelType(analysis.model_type))


@router.get("/{analysis_id}/information-functions")
async def get_information_functions(analysis_id: uuid.UUID, db: DbSession) -> dict[str, Any]:
    from app.core.irt_engine import compute_information_functions

    result = await db.execute(select(Analysis).where(Analysis.id == analysis_id))
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    if analysis.status != "completed" or not analysis.item_parameters:
        raise HTTPException(status_code=400, detail="Analysis not completed")

    return compute_information_functions(analysis.item_parameters, IRTModelType(analysis.model_type))


@router.delete("/{analysis_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_analysis(analysis_id: uuid.UUID, db: DbSession) -> None:
    result = await db.execute(select(Analysis).where(Analysis.id == analysis_id))
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    await db.delete(analysis)
    await db.commit()
