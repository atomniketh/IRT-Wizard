from typing import Any

import mlflow
from fastapi import APIRouter, HTTPException
from mlflow.tracking import MlflowClient

from app.api.deps import SettingsDep

router = APIRouter()


@router.get("/experiments")
async def list_experiments(settings: SettingsDep) -> list[dict[str, Any]]:
    mlflow.set_tracking_uri(settings.mlflow_tracking_uri)
    client = MlflowClient()

    experiments = client.search_experiments()

    result = []
    for exp in experiments:
        runs = client.search_runs(
            experiment_ids=[exp.experiment_id],
            max_results=1000
        )

        result.append({
            "experiment_id": exp.experiment_id,
            "name": exp.name,
            "artifact_location": exp.artifact_location,
            "lifecycle_stage": exp.lifecycle_stage,
            "tags": dict(exp.tags) if exp.tags else {},
            "creation_time": exp.creation_time,
            "last_update_time": exp.last_update_time,
            "run_count": len(runs),
        })

    return result


@router.get("/experiments/{experiment_id}/runs")
async def list_runs(experiment_id: str, settings: SettingsDep) -> list[dict[str, Any]]:
    mlflow.set_tracking_uri(settings.mlflow_tracking_uri)
    client = MlflowClient()

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
async def get_run(run_id: str, settings: SettingsDep) -> dict[str, Any]:
    mlflow.set_tracking_uri(settings.mlflow_tracking_uri)
    client = MlflowClient()

    try:
        run = client.get_run(run_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Run not found: {str(e)}")

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
async def compare_runs(run_ids: str, settings: SettingsDep) -> dict[str, Any]:
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
            runs_data.append({
                "run_id": run.info.run_id,
                "run_name": run.info.run_name,
                "start_time": run.info.start_time,
                "params": dict(run.data.params),
                "metrics": dict(run.data.metrics),
            })
            all_params.update(run.data.params.keys())
            all_metrics.update(run.data.metrics.keys())
        except Exception:
            raise HTTPException(status_code=404, detail=f"Run not found: {run_id}")

    return {
        "runs": runs_data,
        "param_keys": sorted(list(all_params)),
        "metric_keys": sorted(list(all_metrics)),
    }


@router.delete("/runs/{run_id}")
async def delete_run(run_id: str, settings: SettingsDep) -> dict[str, str]:
    mlflow.set_tracking_uri(settings.mlflow_tracking_uri)
    client = MlflowClient()

    try:
        client.delete_run(run_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Failed to delete run: {str(e)}")

    return {"status": "deleted", "run_id": run_id}
