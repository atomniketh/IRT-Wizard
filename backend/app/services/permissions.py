from uuid import UUID
from typing import Annotated

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_db, get_current_user, get_current_organization
from app.models import (
    User,
    Organization,
    OrganizationMembership,
    Role,
    Permission,
    Project,
)


class PermissionService:
    def __init__(
        self,
        db: AsyncSession,
        user: User,
        organization: Organization | None,
    ):
        self.db = db
        self.user = user
        self.organization = organization

    async def get_user_permissions_for_org(self, organization_id: UUID) -> set[str]:
        if self.user.is_superuser:
            result = await self.db.execute(select(Permission.code))
            return set(result.scalars().all())

        result = await self.db.execute(
            select(OrganizationMembership)
            .options(selectinload(OrganizationMembership.role).selectinload(Role.permissions))
            .where(
                OrganizationMembership.user_id == self.user.id,
                OrganizationMembership.organization_id == organization_id,
            )
        )
        membership = result.scalar_one_or_none()

        if membership is None:
            return set()

        return {perm.code for perm in membership.role.permissions}

    async def get_user_role_for_org(self, organization_id: UUID) -> Role | None:
        result = await self.db.execute(
            select(OrganizationMembership)
            .options(selectinload(OrganizationMembership.role))
            .where(
                OrganizationMembership.user_id == self.user.id,
                OrganizationMembership.organization_id == organization_id,
            )
        )
        membership = result.scalar_one_or_none()
        return membership.role if membership else None

    async def has_permission(self, permission_code: str, organization_id: UUID | None = None) -> bool:
        if self.user.is_superuser:
            return True

        if organization_id is None and self.organization:
            organization_id = self.organization.id

        if organization_id is None:
            return True

        permissions = await self.get_user_permissions_for_org(organization_id)
        return permission_code in permissions

    async def require_permission(self, permission_code: str, organization_id: UUID | None = None) -> None:
        if not await self.has_permission(permission_code, organization_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: {permission_code}",
            )

    async def can_access_project(self, project: Project) -> bool:
        if self.user.is_superuser:
            return True

        if project.owner_user_id == self.user.id:
            return True

        if project.owner_organization_id:
            permissions = await self.get_user_permissions_for_org(project.owner_organization_id)
            return "project:read" in permissions

        return False

    async def require_project_access(self, project: Project, permission_code: str = "project:read") -> None:
        if self.user.is_superuser:
            return

        if project.owner_user_id == self.user.id:
            return

        if project.owner_organization_id:
            await self.require_permission(permission_code, project.owner_organization_id)
            return

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    async def get_accessible_projects_filter(self):
        if self.user.is_superuser:
            return True

        accessible_org_ids = await self._get_user_org_ids_with_permission("project:read")

        from sqlalchemy import or_
        return or_(
            Project.owner_user_id == self.user.id,
            Project.owner_organization_id.in_(accessible_org_ids),
        )

    async def _get_user_org_ids_with_permission(self, permission_code: str) -> list[UUID]:
        result = await self.db.execute(
            select(OrganizationMembership.organization_id)
            .join(OrganizationMembership.role)
            .join(Role.permissions)
            .where(
                OrganizationMembership.user_id == self.user.id,
                Permission.code == permission_code,
            )
        )
        return list(result.scalars().all())


async def get_permission_service(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    organization: Annotated[Organization | None, Depends(get_current_organization)],
) -> PermissionService:
    return PermissionService(db, user, organization)


PermissionServiceDep = Annotated[PermissionService, Depends(get_permission_service)]
