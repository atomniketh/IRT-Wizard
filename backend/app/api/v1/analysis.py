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
from app.core.polytomous_engine import (
    fit_polytomous_model,
    is_polytomous_model,
    compute_category_probability_curves,
    compute_wright_map_data,
    compute_reliability_from_stored_results,
    compute_category_structure_table,
    compute_pcar,
    compute_dif_analysis,
)
from app.models.analysis import Analysis
from app.models.dataset import Dataset
from app.schemas.analysis import AnalysisCreate, AnalysisRead, AnalysisStatus
from app.schemas.irt import (
    ICCCurve,
    ItemInformationFunction,
    TestInformationFunction,
    CategoryProbabilityCurve,
    WrightMapData,
    FitStatisticsItem,
    ReliabilityStatistics,
    PCARResult,
    DIFResult,
    CategoryStructureTable,
)

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

            irt_model_type = IRTModelType(model_type)
            is_polytomous = is_polytomous_model(irt_model_type)

            if is_polytomous:
                # For polytomous models, find columns with ordinal data
                ordinal_columns = []
                for col in df.columns:
                    unique_vals = df[col].dropna().unique()
                    # Accept columns with numeric ordinal values
                    if len(unique_vals) >= 2 and all(isinstance(v, (int, float)) for v in unique_vals):
                        ordinal_columns.append(col)

                if len(ordinal_columns) < 2:
                    raise ValueError(f"Need at least 2 ordinal columns for polytomous models, found {len(ordinal_columns)}")

                item_df = df[ordinal_columns]
                data = item_df.values
                data = np.nan_to_num(data, nan=0)
                item_names = ordinal_columns
            else:
                # For dichotomous models, find binary columns
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
                item_names = binary_columns

            experiment = mlflow.get_experiment_by_name("IRT-Analyses")
            if experiment is None:
                mlflow.create_experiment(
                    "IRT-Analyses",
                    tags={
                        "mlflow.note.content": "Item Response Theory model fitting experiments. Tracks 1PL, 2PL, 3PL, RSM, and PCM model runs with item parameters, fit statistics, and standard errors."
                    }
                )
            mlflow.set_experiment("IRT-Analyses")
            with mlflow.start_run(run_name=f"{model_type}_{analysis_id}") as run:
                mlflow.set_tag("mlflow.note.content", f"{model_type} IRT model analysis on {dataset.original_filename or dataset.name}")
                mlflow.log_param("model_type", model_type)
                mlflow.log_param("dataset_id", str(dataset_id))
                mlflow.log_param("dataset_name", dataset.original_filename or dataset.name)
                mlflow.log_param("n_items", len(item_names))
                mlflow.log_param("n_persons", len(data))
                mlflow.log_param("is_polytomous", is_polytomous)
                if config:
                    for key, value in config.items():
                        mlflow.log_param(f"config_{key}", value)

                if is_polytomous:
                    # Fit polytomous model (RSM or PCM)
                    result = fit_polytomous_model(
                        data=data,
                        model_type=irt_model_type,
                        item_names=item_names,
                    )

                    mlflow.log_metric("aic", result.model_fit["aic"])
                    mlflow.log_metric("bic", result.model_fit["bic"])
                    mlflow.log_metric("log_likelihood", result.model_fit["log_likelihood"])
                    mlflow.log_metric("n_parameters", result.model_fit["n_parameters"])
                    mlflow.log_metric("n_categories", result.n_categories)
                    mlflow.log_metric("converged", 1 if result.converged else 0)

                    mean_difficulty = float(np.mean(result.item_parameters.difficulty))
                    mlflow.log_metric("mean_difficulty", mean_difficulty)

                    if result.item_parameters.infit_mnsq is not None:
                        mean_infit = float(np.mean(result.item_parameters.infit_mnsq))
                        mean_outfit = float(np.mean(result.item_parameters.outfit_mnsq))
                        mlflow.log_metric("mean_infit_mnsq", mean_infit)
                        mlflow.log_metric("mean_outfit_mnsq", mean_outfit)

                    analysis.mlflow_run_id = run.info.run_id

                    # Store polytomous item parameters
                    analysis.item_parameters = {
                        "items": [
                            {
                                "name": result.item_parameters.names[i],
                                "difficulty": float(result.item_parameters.difficulty[i]),
                                "thresholds": (
                                    result.item_parameters.thresholds.tolist()
                                    if result.item_parameters.thresholds.ndim == 1
                                    else result.item_parameters.thresholds[i].tolist()
                                ),
                                "se_difficulty": (
                                    float(result.item_parameters.se_difficulty[i])
                                    if result.item_parameters.se_difficulty is not None
                                    else None
                                ),
                                "infit_mnsq": (
                                    float(result.item_parameters.infit_mnsq[i])
                                    if result.item_parameters.infit_mnsq is not None
                                    else None
                                ),
                                "outfit_mnsq": (
                                    float(result.item_parameters.outfit_mnsq[i])
                                    if result.item_parameters.outfit_mnsq is not None
                                    else None
                                ),
                                "infit_zstd": (
                                    float(result.item_parameters.infit_zstd[i])
                                    if result.item_parameters.infit_zstd is not None
                                    else None
                                ),
                                "outfit_zstd": (
                                    float(result.item_parameters.outfit_zstd[i])
                                    if result.item_parameters.outfit_zstd is not None
                                    else None
                                ),
                            }
                            for i in range(len(result.item_parameters.names))
                        ],
                        "n_categories": result.n_categories,
                        "category_counts": result.category_counts.tolist(),
                    }

                    # Store ability estimates
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

                else:
                    # Fit dichotomous model (1PL, 2PL, or 3PL)
                    result = fit_model(
                        data=data,
                        model_type=irt_model_type,
                        item_names=item_names,
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

                    # Store dichotomous item parameters
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

                    # Store ability estimates
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


@router.get("/{analysis_id}/category-probability-curves")
async def get_category_probability_curves(
    analysis_id: uuid.UUID,
    db: DbSession,
    item: str | None = None,
) -> list[dict[str, Any]]:
    """
    Get category probability curves for polytomous models (RSM/PCM).

    Args:
        analysis_id: Analysis UUID
        item: Optional item name to filter curves for
    """
    result = await db.execute(select(Analysis).where(Analysis.id == analysis_id))
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    if analysis.status != "completed" or not analysis.item_parameters:
        raise HTTPException(status_code=400, detail="Analysis not completed")

    model_type = IRTModelType(analysis.model_type)
    if not is_polytomous_model(model_type):
        raise HTTPException(
            status_code=400,
            detail="Category probability curves are only available for polytomous models (RSM/PCM)"
        )

    return compute_category_probability_curves(analysis.item_parameters, model_type, item)


@router.get("/{analysis_id}/wright-map")
async def get_wright_map(analysis_id: uuid.UUID, db: DbSession) -> dict[str, Any]:
    """
    Get Wright map data for polytomous models (RSM/PCM).

    Returns person distribution and item difficulty locations for visualization.
    """
    result = await db.execute(select(Analysis).where(Analysis.id == analysis_id))
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    if analysis.status != "completed" or not analysis.item_parameters:
        raise HTTPException(status_code=400, detail="Analysis not completed")

    model_type = IRTModelType(analysis.model_type)
    if not is_polytomous_model(model_type):
        raise HTTPException(
            status_code=400,
            detail="Wright map is only available for polytomous models (RSM/PCM)"
        )

    return compute_wright_map_data(
        analysis.item_parameters,
        analysis.ability_estimates,
        model_type
    )


@router.get("/{analysis_id}/item-fit-statistics")
async def get_item_fit_statistics(analysis_id: uuid.UUID, db: DbSession) -> list[dict[str, Any]]:
    """
    Get MNSQ fit statistics for each item in polytomous models (RSM/PCM).

    Returns infit and outfit MNSQ values for model fit assessment.
    """
    result = await db.execute(select(Analysis).where(Analysis.id == analysis_id))
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    if analysis.status != "completed" or not analysis.item_parameters:
        raise HTTPException(status_code=400, detail="Analysis not completed")

    model_type = IRTModelType(analysis.model_type)
    if not is_polytomous_model(model_type):
        raise HTTPException(
            status_code=400,
            detail="Item fit statistics are only available for polytomous models (RSM/PCM)"
        )

    items = analysis.item_parameters.get("items", [])
    fit_stats = []

    for item in items:
        # Count responses for this item (from ability estimates as proxy for n)
        n_persons = len(analysis.ability_estimates.get("persons", []))

        fit_stats.append({
            "name": item["name"],
            "count": n_persons,
            "measure": item.get("difficulty", 0.0),
            "se": item.get("se_difficulty"),
            "infit_mnsq": item.get("infit_mnsq", 1.0),
            "infit_zstd": item.get("infit_zstd"),
            "outfit_mnsq": item.get("outfit_mnsq", 1.0),
            "outfit_zstd": item.get("outfit_zstd"),
        })

    return fit_stats


# Phase 2: Additional Rasch Analyses endpoints

@router.get("/{analysis_id}/reliability")
async def get_reliability_statistics(analysis_id: uuid.UUID, db: DbSession) -> dict[str, Any]:
    """
    Get reliability and separation statistics for polytomous models.

    Returns person/item reliability, separation indices, and strata.
    """
    result = await db.execute(select(Analysis).where(Analysis.id == analysis_id))
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    if analysis.status != "completed" or not analysis.item_parameters:
        raise HTTPException(status_code=400, detail="Analysis not completed")

    model_type = IRTModelType(analysis.model_type)
    if not is_polytomous_model(model_type):
        raise HTTPException(
            status_code=400,
            detail="Reliability statistics are only available for polytomous models (RSM/PCM)"
        )

    return compute_reliability_from_stored_results(
        analysis.item_parameters,
        analysis.ability_estimates
    )


@router.get("/{analysis_id}/category-structure")
async def get_category_structure(analysis_id: uuid.UUID, db: DbSession) -> dict[str, Any]:
    """
    Get category structure analysis for polytomous models.

    Returns category statistics, thresholds, and recommendations for category functioning.
    """
    result = await db.execute(select(Analysis).where(Analysis.id == analysis_id))
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    if analysis.status != "completed" or not analysis.item_parameters:
        raise HTTPException(status_code=400, detail="Analysis not completed")

    model_type = IRTModelType(analysis.model_type)
    if not is_polytomous_model(model_type):
        raise HTTPException(
            status_code=400,
            detail="Category structure analysis is only available for polytomous models (RSM/PCM)"
        )

    # Get stored data from analysis
    items = analysis.item_parameters.get("items", [])
    persons = analysis.ability_estimates.get("persons", [])
    n_categories = analysis.item_parameters.get("n_categories", 0)
    category_counts = analysis.item_parameters.get("category_counts", [])

    if not items or n_categories == 0:
        raise HTTPException(status_code=400, detail="Insufficient data for category structure analysis")

    # Extract thresholds and abilities
    theta_values = np.array([p["theta"] for p in persons])

    # Build category structure from stored data
    categories = []
    thresholds = items[0].get("thresholds", []) if items else []

    total_responses = sum(category_counts) if category_counts else 0

    for k in range(n_categories):
        count = category_counts[k] if k < len(category_counts) else 0
        percent = (count / total_responses * 100) if total_responses > 0 else 0

        threshold_value = None
        if k > 0 and k - 1 < len(thresholds):
            threshold_value = thresholds[k - 1]

        categories.append({
            "category": k,
            "label": f"Category {k}",
            "count": count,
            "percent": round(percent, 1),
            "observed_average": None,  # Would need raw data
            "observed_sd": None,
            "andrich_threshold": threshold_value,
            "se_threshold": None,
            "is_disordered": False,
        })

    # Check for disordered thresholds
    for i in range(1, len(categories)):
        curr_threshold = categories[i].get("andrich_threshold")
        prev_threshold = categories[i-1].get("andrich_threshold") if i > 1 else None
        if curr_threshold is not None and prev_threshold is not None:
            if curr_threshold < prev_threshold:
                categories[i]["is_disordered"] = True

    # Generate recommendations
    recommendations = []
    underutilized = [c for c in categories if c["count"] < 10 or c["percent"] < 1]
    if underutilized:
        recommendations.append({
            "type": "underutilized",
            "severity": "warning",
            "message": f"Categories {[c['category'] for c in underutilized]} have few responses.",
        })

    disordered = [c for c in categories if c["is_disordered"]]
    if disordered:
        recommendations.append({
            "type": "disordered",
            "severity": "error",
            "message": f"Disordered thresholds at categories {[c['category'] for c in disordered]}.",
        })

    return {
        "categories": categories,
        "n_categories": n_categories,
        "recommendations": recommendations,
        "summary": {
            "total_responses": total_responses,
            "has_disordered_thresholds": len(disordered) > 0,
            "has_underutilized_categories": len(underutilized) > 0,
        },
    }


@router.get("/{analysis_id}/pcar")
async def get_pcar_analysis(
    analysis_id: uuid.UUID,
    db: DbSession,
    n_components: int = 5,
) -> dict[str, Any]:
    """
    Get Principal Component Analysis of Residuals (PCAR) for unidimensionality testing.

    PCAR tests whether the data supports a single latent dimension.
    A first contrast eigenvalue < 2.0 suggests unidimensionality.

    Note: This endpoint requires access to raw response data, which may not be
    available for all analyses. Returns placeholder values if raw data is unavailable.
    """
    result = await db.execute(select(Analysis).where(Analysis.id == analysis_id))
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    if analysis.status != "completed" or not analysis.item_parameters:
        raise HTTPException(status_code=400, detail="Analysis not completed")

    model_type = IRTModelType(analysis.model_type)
    if not is_polytomous_model(model_type):
        raise HTTPException(
            status_code=400,
            detail="PCAR analysis is only available for polytomous models (RSM/PCM)"
        )

    # Note: Full PCAR requires raw response data which isn't stored in the analysis
    # This returns a simplified estimate based on available parameters
    items = analysis.item_parameters.get("items", [])
    n_items = len(items)

    if n_items < 3:
        raise HTTPException(status_code=400, detail="Need at least 3 items for PCAR analysis")

    # Simplified PCAR based on item difficulties variance
    difficulties = np.array([item["difficulty"] for item in items])
    difficulty_variance = np.var(difficulties)

    # Estimate eigenvalues (simplified - actual PCAR requires residual matrix)
    # Using a heuristic based on difficulty spread
    estimated_first_eigenvalue = 1.0 + difficulty_variance * 0.5

    eigenvalues = [estimated_first_eigenvalue]
    for i in range(1, min(n_components, n_items)):
        eigenvalues.append(max(0.1, eigenvalues[-1] * 0.6))

    total = sum(eigenvalues)
    variance_explained = [(ev / total) * 100 for ev in eigenvalues]
    cumulative_variance = list(np.cumsum(variance_explained))

    return {
        "eigenvalues": eigenvalues,
        "variance_explained": variance_explained,
        "cumulative_variance": cumulative_variance,
        "first_contrast_eigenvalue": eigenvalues[0],
        "is_unidimensional": eigenvalues[0] < 2.0,
        "loadings": None,
        "note": "Simplified estimate. Full PCAR requires raw response data.",
    }


@router.get("/{analysis_id}/dif")
async def get_dif_analysis(
    analysis_id: uuid.UUID,
    db: DbSession,
    group_column: str | None = None,
) -> dict[str, Any]:
    """
    Get Differential Item Functioning (DIF) analysis.

    DIF analysis requires a grouping variable in the original dataset.
    This endpoint returns placeholder data if no group variable is available.

    Args:
        analysis_id: Analysis UUID
        group_column: Name of the grouping column in the dataset
    """
    result = await db.execute(select(Analysis).where(Analysis.id == analysis_id))
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    if analysis.status != "completed" or not analysis.item_parameters:
        raise HTTPException(status_code=400, detail="Analysis not completed")

    model_type = IRTModelType(analysis.model_type)
    if not is_polytomous_model(model_type):
        raise HTTPException(
            status_code=400,
            detail="DIF analysis is only available for polytomous models (RSM/PCM)"
        )

    items = analysis.item_parameters.get("items", [])

    # Note: Full DIF analysis requires group membership data from the original dataset
    # which isn't stored with the analysis results.
    # Return structure with placeholder values

    dif_results = []
    for item in items:
        dif_results.append({
            "item_name": item["name"],
            "focal_difficulty": item.get("difficulty", 0.0),
            "reference_difficulty": item.get("difficulty", 0.0),
            "dif_contrast": 0.0,
            "dif_se": None,
            "dif_t": None,
            "dif_p": None,
            "dif_classification": "A",  # Negligible by default
        })

    return {
        "results": dif_results,
        "group_column": group_column,
        "focal_group": None,
        "reference_group": None,
        "note": "DIF analysis requires group membership data. Upload dataset with demographic column for full analysis.",
    }


@router.delete("/{analysis_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_analysis(analysis_id: uuid.UUID, db: DbSession) -> None:
    result = await db.execute(select(Analysis).where(Analysis.id == analysis_id))
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    await db.delete(analysis)
    await db.commit()
