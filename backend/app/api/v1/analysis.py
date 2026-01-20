import io
import uuid
from datetime import datetime
from typing import Any

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
) -> None:
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session

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
            data = df.values

            irt_model_type = IRTModelType(model_type)
            result = fit_model(
                data=data,
                model_type=irt_model_type,
                item_names=list(df.columns),
            )

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
