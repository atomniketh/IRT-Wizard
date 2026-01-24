import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.deps import DbSession, CurrentUser, CurrentOrganization
from app.models.analysis import Analysis
from app.models.project import Project
from app.schemas.analysis import AnalysisRead
from app.schemas.project import ProjectCreate, ProjectRead, ProjectUpdate
from app.services.permissions import PermissionServiceDep

router = APIRouter()


@router.get("", response_model=list[ProjectRead])
async def list_projects(
    db: DbSession,
    current_user: CurrentUser,
    current_org: CurrentOrganization,
    permissions: PermissionServiceDep,
) -> list[Project]:
    access_filter = await permissions.get_accessible_projects_filter()

    query = select(Project).where(access_filter)

    if current_org:
        query = query.where(Project.owner_organization_id == current_org.id)

    result = await db.execute(query.order_by(Project.created_at.desc()))
    return list(result.scalars().all())


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
async def create_project(
    project_in: ProjectCreate,
    db: DbSession,
    current_user: CurrentUser,
    current_org: CurrentOrganization,
    permissions: PermissionServiceDep,
) -> Project:
    if current_org:
        await permissions.require_permission("project:create", current_org.id)
        project = Project(
            name=project_in.name,
            description=project_in.description,
            competency_level=project_in.competency_level.value,
            owner_organization_id=current_org.id,
        )
    else:
        project = Project(
            name=project_in.name,
            description=project_in.description,
            competency_level=project_in.competency_level.value,
            owner_user_id=current_user.id,
        )

    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


@router.get("/{project_id}", response_model=ProjectRead)
async def get_project(
    project_id: uuid.UUID,
    db: DbSession,
    current_user: CurrentUser,
    permissions: PermissionServiceDep,
) -> Project:
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    await permissions.require_project_access(project, "project:read")
    return project


@router.get("/{project_id}/analyses", response_model=list[AnalysisRead])
async def list_project_analyses(
    project_id: uuid.UUID,
    db: DbSession,
    current_user: CurrentUser,
    permissions: PermissionServiceDep,
) -> list[Analysis]:
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    await permissions.require_project_access(project, "project:read")

    result = await db.execute(
        select(Analysis)
        .where(Analysis.project_id == project_id)
        .order_by(Analysis.created_at.desc())
    )
    return list(result.scalars().all())


@router.put("/{project_id}", response_model=ProjectRead)
async def update_project(
    project_id: uuid.UUID,
    project_in: ProjectUpdate,
    db: DbSession,
    current_user: CurrentUser,
    permissions: PermissionServiceDep,
) -> Project:
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    await permissions.require_project_access(project, "project:update")

    update_data = project_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "competency_level" and value is not None:
            setattr(project, field, value.value)
        else:
            setattr(project, field, value)

    await db.commit()
    await db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: uuid.UUID,
    db: DbSession,
    current_user: CurrentUser,
    permissions: PermissionServiceDep,
) -> None:
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    await permissions.require_project_access(project, "project:delete")

    await db.delete(project)
    await db.commit()
