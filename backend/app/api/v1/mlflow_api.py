from typing import Any
from uuid import UUID, uuid4

import mlflow
from fastapi import APIRouter, HTTPException
from mlflow.tracking import MlflowClient
from sqlalchemy import or_, select

from app.api.deps import CurrentUser, CurrentOrganization, DbSession, SettingsDep
from app.models import Experiment
from app.schemas.experiment import (
    ExperimentCreate,
    ExperimentListItem,
    ExperimentResponse,
    ExperimentWithMLflow,
)

router = APIRouter()


async def get_accessible_experiment_ids(
    db: DbSession,
    user: CurrentUser,
    organization: CurrentOrganization,
) -> set[str]:
    if organization:
        query = select(Experiment.mlflow_experiment_id).where(
            Experiment.owner_organization_id == organization.id
        )
    else:
        from app.models import OrganizationMembership

        user_org_ids_query = select(OrganizationMembership.organization_id).where(
            OrganizationMembership.user_id == user.id
        )
        query = select(Experiment.mlflow_experiment_id).where(
            or_(
                Experiment.owner_user_id == user.id,
                Experiment.owner_organization_id.in_(user_org_ids_query),
            )
        )

    result = await db.execute(query)
    return {row[0] for row in result.all()}


async def get_experiment_by_mlflow_id(
    db: DbSession,
    mlflow_experiment_id: str,
) -> Experiment | None:
    query = select(Experiment).where(
        Experiment.mlflow_experiment_id == mlflow_experiment_id
    )
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def check_experiment_access(
    db: DbSession,
    user: CurrentUser,
    organization: CurrentOrganization,
    mlflow_experiment_id: str,
) -> Experiment:
    experiment = await get_experiment_by_mlflow_id(db, mlflow_experiment_id)
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")

    accessible_ids = await get_accessible_experiment_ids(db, user, organization)
    if mlflow_experiment_id not in accessible_ids:
        raise HTTPException(status_code=403, detail="Access denied to this experiment")

    return experiment


@router.get("/experiments", response_model=list[ExperimentWithMLflow])
async def list_experiments(
    settings: SettingsDep,
    db: DbSession,
    user: CurrentUser,
    organization: CurrentOrganization,
) -> list[dict[str, Any]]:
    mlflow.set_tracking_uri(settings.mlflow_tracking_uri)
    client = MlflowClient()

    accessible_ids = await get_accessible_experiment_ids(db, user, organization)

    mlflow_experiments = client.search_experiments()

    result = []
    for exp in mlflow_experiments:
        if exp.experiment_id not in accessible_ids:
            continue

        db_experiment = await get_experiment_by_mlflow_id(db, exp.experiment_id)
        if not db_experiment:
            continue

        runs = client.search_runs(
            experiment_ids=[exp.experiment_id],
            max_results=1000
        )

        result.append({
            "id": db_experiment.id,
            "mlflow_experiment_id": exp.experiment_id,
            "name": db_experiment.name,
            "description": db_experiment.description,
            "owner_user_id": db_experiment.owner_user_id,
            "owner_organization_id": db_experiment.owner_organization_id,
            "created_at": db_experiment.created_at,
            "artifact_location": exp.artifact_location,
            "lifecycle_stage": exp.lifecycle_stage,
            "tags": dict(exp.tags) if exp.tags else {},
            "creation_time": exp.creation_time,
            "last_update_time": exp.last_update_time,
            "run_count": len(runs),
        })

    return result


@router.post("/experiments", response_model=ExperimentResponse)
async def create_experiment(
    data: ExperimentCreate,
    settings: SettingsDep,
    db: DbSession,
    user: CurrentUser,
    organization: CurrentOrganization,
) -> Experiment:
    mlflow.set_tracking_uri(settings.mlflow_tracking_uri)
    client = MlflowClient()

    try:
        mlflow_experiment_id = client.create_experiment(data.name)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to create MLflow experiment: {str(e)}")

    experiment = Experiment(
        id=uuid4(),
        mlflow_experiment_id=mlflow_experiment_id,
        name=data.name,
        description=data.description,
        owner_user_id=user.id if not organization else None,
        owner_organization_id=organization.id if organization else None,
    )

    db.add(experiment)
    await db.commit()
    await db.refresh(experiment)

    return experiment


@router.get("/experiments/{experiment_id}", response_model=ExperimentWithMLflow)
async def get_experiment(
    experiment_id: str,
    settings: SettingsDep,
    db: DbSession,
    user: CurrentUser,
    organization: CurrentOrganization,
) -> dict[str, Any]:
    mlflow.set_tracking_uri(settings.mlflow_tracking_uri)
    client = MlflowClient()

    db_experiment = await check_experiment_access(db, user, organization, experiment_id)

    try:
        exp = client.get_experiment(experiment_id)
    except Exception:
        raise HTTPException(status_code=404, detail="MLflow experiment not found")

    runs = client.search_runs(
        experiment_ids=[experiment_id],
        max_results=1000
    )

    return {
        "id": db_experiment.id,
        "mlflow_experiment_id": exp.experiment_id,
        "name": db_experiment.name,
        "description": db_experiment.description,
        "owner_user_id": db_experiment.owner_user_id,
        "owner_organization_id": db_experiment.owner_organization_id,
        "created_at": db_experiment.created_at,
        "artifact_location": exp.artifact_location,
        "lifecycle_stage": exp.lifecycle_stage,
        "tags": dict(exp.tags) if exp.tags else {},
        "creation_time": exp.creation_time,
        "last_update_time": exp.last_update_time,
        "run_count": len(runs),
    }


@router.delete("/experiments/{experiment_id}")
async def delete_experiment(
    experiment_id: str,
    settings: SettingsDep,
    db: DbSession,
    user: CurrentUser,
    organization: CurrentOrganization,
) -> dict[str, str]:
    mlflow.set_tracking_uri(settings.mlflow_tracking_uri)
    client = MlflowClient()

    db_experiment = await check_experiment_access(db, user, organization, experiment_id)

    try:
        client.delete_experiment(experiment_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to delete MLflow experiment: {str(e)}")

    await db.delete(db_experiment)
    await db.commit()

    return {"status": "deleted", "experiment_id": experiment_id}


@router.get("/experiments/{experiment_id}/runs")
async def list_runs(
    experiment_id: str,
    settings: SettingsDep,
    db: DbSession,
    user: CurrentUser,
    organization: CurrentOrganization,
) -> list[dict[str, Any]]:
    mlflow.set_tracking_uri(settings.mlflow_tracking_uri)
    client = MlflowClient()

    await check_experiment_access(db, user, organization, experiment_id)

    runs = client.search_runs(
        experiment_ids=[experiment_id],
        order_by=["start_time DESC"],
        max_results=100
    )

    result = []
    for run in runs:
        result.append({
            "run_id": run.info.run_id,
            "run_name": run.info.run_name,
            "status": run.info.status,
            "start_time": run.info.start_time,
            "end_time": run.info.end_time,
            "artifact_uri": run.info.artifact_uri,
            "params": dict(run.data.params),
            "metrics": dict(run.data.metrics),
            "tags": {k: v for k, v in run.data.tags.items() if not k.startswith("mlflow.")},
        })

    return result


@router.get("/runs/{run_id}")
async def get_run(
    run_id: str,
    settings: SettingsDep,
    db: DbSession,
    user: CurrentUser,
    organization: CurrentOrganization,
) -> dict[str, Any]:
    mlflow.set_tracking_uri(settings.mlflow_tracking_uri)
    client = MlflowClient()

    try:
        run = client.get_run(run_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Run not found: {str(e)}")

    await check_experiment_access(db, user, organization, run.info.experiment_id)

    metric_history = {}
    for metric_key in run.data.metrics.keys():
        history = client.get_metric_history(run_id, metric_key)
        metric_history[metric_key] = [
            {"timestamp": m.timestamp, "step": m.step, "value": m.value}
            for m in history
        ]

    return {
        "run_id": run.info.run_id,
        "run_name": run.info.run_name,
        "experiment_id": run.info.experiment_id,
        "status": run.info.status,
        "start_time": run.info.start_time,
        "end_time": run.info.end_time,
        "artifact_uri": run.info.artifact_uri,
        "params": dict(run.data.params),
        "metrics": dict(run.data.metrics),
        "metric_history": metric_history,
        "tags": dict(run.data.tags),
    }


@router.get("/compare")
async def compare_runs(
    run_ids: str,
    settings: SettingsDep,
    db: DbSession,
    user: CurrentUser,
    organization: CurrentOrganization,
) -> dict[str, Any]:
    mlflow.set_tracking_uri(settings.mlflow_tracking_uri)
    client = MlflowClient()

    ids = [r.strip() for r in run_ids.split(",") if r.strip()]

    if len(ids) < 2:
        raise HTTPException(status_code=400, detail="At least 2 run IDs required for comparison")

    runs_data = []
    all_params = set()
    all_metrics = set()

    for run_id in ids:
        try:
            run = client.get_run(run_id)
            await check_experiment_access(db, user, organization, run.info.experiment_id)

            runs_data.append({
                "run_id": run.info.run_id,
                "run_name": run.info.run_name,
                "start_time": run.info.start_time,
                "params": dict(run.data.params),
                "metrics": dict(run.data.metrics),
            })
            all_params.update(run.data.params.keys())
            all_metrics.update(run.data.metrics.keys())
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=404, detail=f"Run not found: {run_id}")

    return {
        "runs": runs_data,
        "param_keys": sorted(list(all_params)),
        "metric_keys": sorted(list(all_metrics)),
    }


@router.delete("/runs/{run_id}")
async def delete_run(
    run_id: str,
    settings: SettingsDep,
    db: DbSession,
    user: CurrentUser,
    organization: CurrentOrganization,
) -> dict[str, str]:
    mlflow.set_tracking_uri(settings.mlflow_tracking_uri)
    client = MlflowClient()

    try:
        run = client.get_run(run_id)
    except Exception:
        raise HTTPException(status_code=404, detail=f"Run not found: {run_id}")

    await check_experiment_access(db, user, organization, run.info.experiment_id)

    try:
        client.delete_run(run_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to delete run: {str(e)}")

    return {"status": "deleted", "run_id": run_id}


@router.post("/experiments/{experiment_id}/claim")
async def claim_experiment(
    experiment_id: str,
    settings: SettingsDep,
    db: DbSession,
    user: CurrentUser,
    organization: CurrentOrganization,
) -> ExperimentResponse:
    mlflow.set_tracking_uri(settings.mlflow_tracking_uri)
    client = MlflowClient()

    existing = await get_experiment_by_mlflow_id(db, experiment_id)
    if existing:
        raise HTTPException(status_code=400, detail="Experiment already has an owner")

    try:
        exp = client.get_experiment(experiment_id)
    except Exception:
        raise HTTPException(status_code=404, detail="MLflow experiment not found")

    experiment = Experiment(
        id=uuid4(),
        mlflow_experiment_id=experiment_id,
        name=exp.name,
        description=None,
        owner_user_id=user.id if not organization else None,
        owner_organization_id=organization.id if organization else None,
    )

    db.add(experiment)
    await db.commit()
    await db.refresh(experiment)

    return experiment


@router.get("/experiments/unclaimed/list")
async def list_unclaimed_experiments(
    settings: SettingsDep,
    db: DbSession,
    user: CurrentUser,
) -> list[dict[str, Any]]:
    mlflow.set_tracking_uri(settings.mlflow_tracking_uri)
    client = MlflowClient()

    query = select(Experiment.mlflow_experiment_id)
    result = await db.execute(query)
    claimed_ids = {row[0] for row in result.all()}

    mlflow_experiments = client.search_experiments()

    unclaimed = []
    for exp in mlflow_experiments:
        if exp.experiment_id not in claimed_ids:
            runs = client.search_runs(
                experiment_ids=[exp.experiment_id],
                max_results=1000
            )
            unclaimed.append({
                "mlflow_experiment_id": exp.experiment_id,
                "name": exp.name,
                "artifact_location": exp.artifact_location,
                "lifecycle_stage": exp.lifecycle_stage,
                "tags": dict(exp.tags) if exp.tags else {},
                "creation_time": exp.creation_time,
                "last_update_time": exp.last_update_time,
                "run_count": len(runs),
            })

    return unclaimed
