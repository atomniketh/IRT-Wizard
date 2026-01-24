from fastapi import APIRouter

from app.api.v1 import projects, datasets, analysis, exports, settings, mlflow_api, organizations, users

api_router = APIRouter()

api_router.include_router(users.router)
api_router.include_router(organizations.router)
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(datasets.router, prefix="/datasets", tags=["datasets"])
api_router.include_router(analysis.router, prefix="/analyses", tags=["analyses"])
api_router.include_router(exports.router, prefix="/exports", tags=["exports"])
api_router.include_router(settings.router, prefix="/settings", tags=["settings"])
api_router.include_router(mlflow_api.router, prefix="/mlflow", tags=["mlflow"])
