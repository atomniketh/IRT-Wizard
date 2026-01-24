from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import DbSession, CurrentUser
from app.models import Organization, OrganizationMembership, Role, User, Permission
from app.schemas.organization import (
    OrganizationCreate,
    OrganizationUpdate,
    OrganizationResponse,
    OrganizationListItem,
    MemberInvite,
    MemberResponse,
    MemberRoleUpdate,
    RoleCreate,
    RoleUpdate,
    RoleResponse,
)
from app.services.permissions import PermissionServiceDep

router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.get("", response_model=list[OrganizationListItem])
async def list_organizations(
    db: DbSession,
    current_user: CurrentUser,
) -> list[OrganizationListItem]:
    result = await db.execute(
        select(OrganizationMembership)
        .options(
            selectinload(OrganizationMembership.organization),
            selectinload(OrganizationMembership.role),
        )
        .where(OrganizationMembership.user_id == current_user.id)
    )
    memberships = result.scalars().all()

    return [
        OrganizationListItem(
            id=m.organization.id,
            slug=m.organization.slug,
            name=m.organization.name,
            role=m.role.name,
            created_at=m.organization.created_at,
        )
        for m in memberships
        if m.organization.is_active
    ]


@router.post("", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED)
async def create_organization(
    data: OrganizationCreate,
    db: DbSession,
    current_user: CurrentUser,
) -> OrganizationResponse:
    existing = await db.execute(
        select(Organization).where(Organization.slug == data.slug)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Organization with this slug already exists",
        )

    organization = Organization(
        slug=data.slug,
        name=data.name,
        description=data.description,
    )
    db.add(organization)
    await db.flush()

    owner_role = await db.execute(
        select(Role).where(Role.name == "owner", Role.is_system == True)
    )
    owner_role = owner_role.scalar_one_or_none()
    if not owner_role:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="System owner role not found",
        )

    membership = OrganizationMembership(
        user_id=current_user.id,
        organization_id=organization.id,
        role_id=owner_role.id,
    )
    db.add(membership)

    await db.commit()
    await db.refresh(organization)

    return organization


@router.get("/{org_id}", response_model=OrganizationResponse)
async def get_organization(
    org_id: UUID,
    db: DbSession,
    permissions: PermissionServiceDep,
) -> OrganizationResponse:
    result = await db.execute(
        select(Organization).where(Organization.id == org_id, Organization.is_active == True)
    )
    organization = result.scalar_one_or_none()

    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    await permissions.require_permission("org:read", org_id)

    return organization


@router.put("/{org_id}", response_model=OrganizationResponse)
async def update_organization(
    org_id: UUID,
    data: OrganizationUpdate,
    db: DbSession,
    permissions: PermissionServiceDep,
) -> OrganizationResponse:
    result = await db.execute(
        select(Organization).where(Organization.id == org_id, Organization.is_active == True)
    )
    organization = result.scalar_one_or_none()

    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    await permissions.require_permission("org:update", org_id)

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(organization, key, value)

    await db.commit()
    await db.refresh(organization)

    return organization


@router.delete("/{org_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_organization(
    org_id: UUID,
    db: DbSession,
    permissions: PermissionServiceDep,
) -> None:
    result = await db.execute(
        select(Organization).where(Organization.id == org_id, Organization.is_active == True)
    )
    organization = result.scalar_one_or_none()

    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    await permissions.require_permission("org:delete", org_id)

    organization.is_active = False
    await db.commit()


@router.get("/{org_id}/members", response_model=list[MemberResponse])
async def list_members(
    org_id: UUID,
    db: DbSession,
    permissions: PermissionServiceDep,
) -> list[MemberResponse]:
    await permissions.require_permission("org:read", org_id)

    result = await db.execute(
        select(OrganizationMembership)
        .options(
            selectinload(OrganizationMembership.user),
            selectinload(OrganizationMembership.role),
        )
        .where(OrganizationMembership.organization_id == org_id)
    )
    memberships = result.scalars().all()

    return [
        MemberResponse(
            id=m.id,
            user_id=m.user.id,
            email=m.user.email,
            display_name=m.user.display_name,
            avatar_url=m.user.avatar_url,
            role_id=m.role_id,
            role_name=m.role.name,
            joined_at=m.joined_at,
        )
        for m in memberships
    ]


@router.post("/{org_id}/members", response_model=MemberResponse, status_code=status.HTTP_201_CREATED)
async def invite_member(
    org_id: UUID,
    data: MemberInvite,
    db: DbSession,
    current_user: CurrentUser,
    permissions: PermissionServiceDep,
) -> MemberResponse:
    await permissions.require_permission("member:invite", org_id)

    user_result = await db.execute(
        select(User).where(User.email == data.email)
    )
    user = user_result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found with this email",
        )

    existing = await db.execute(
        select(OrganizationMembership).where(
            OrganizationMembership.user_id == user.id,
            OrganizationMembership.organization_id == org_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already a member",
        )

    role_result = await db.execute(
        select(Role).where(
            Role.name == data.role_name,
            (Role.organization_id == org_id) | (Role.is_system == True),
        )
    )
    role = role_result.scalar_one_or_none()

    if not role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role '{data.role_name}' not found",
        )

    membership = OrganizationMembership(
        user_id=user.id,
        organization_id=org_id,
        role_id=role.id,
        invited_by_id=current_user.id,
    )
    db.add(membership)
    await db.commit()
    await db.refresh(membership)

    return MemberResponse(
        id=membership.id,
        user_id=user.id,
        email=user.email,
        display_name=user.display_name,
        avatar_url=user.avatar_url,
        role_id=role.id,
        role_name=role.name,
        joined_at=membership.joined_at,
    )


@router.delete("/{org_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    org_id: UUID,
    user_id: UUID,
    db: DbSession,
    current_user: CurrentUser,
    permissions: PermissionServiceDep,
) -> None:
    await permissions.require_permission("member:remove", org_id)

    result = await db.execute(
        select(OrganizationMembership)
        .options(selectinload(OrganizationMembership.role))
        .where(
            OrganizationMembership.user_id == user_id,
            OrganizationMembership.organization_id == org_id,
        )
    )
    membership = result.scalar_one_or_none()

    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Membership not found",
        )

    if membership.role.name == "owner":
        owner_count = await db.execute(
            select(OrganizationMembership)
            .join(OrganizationMembership.role)
            .where(
                OrganizationMembership.organization_id == org_id,
                Role.name == "owner",
            )
        )
        owners = owner_count.scalars().all()
        if len(owners) <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove the last owner",
            )

    await db.delete(membership)
    await db.commit()


@router.put("/{org_id}/members/{user_id}/role", response_model=MemberResponse)
async def update_member_role(
    org_id: UUID,
    user_id: UUID,
    data: MemberRoleUpdate,
    db: DbSession,
    permissions: PermissionServiceDep,
) -> MemberResponse:
    await permissions.require_permission("member:update_role", org_id)

    result = await db.execute(
        select(OrganizationMembership)
        .options(
            selectinload(OrganizationMembership.user),
            selectinload(OrganizationMembership.role),
        )
        .where(
            OrganizationMembership.user_id == user_id,
            OrganizationMembership.organization_id == org_id,
        )
    )
    membership = result.scalar_one_or_none()

    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Membership not found",
        )

    if membership.role.name == "owner" and data.role_name != "owner":
        owner_count = await db.execute(
            select(OrganizationMembership)
            .join(OrganizationMembership.role)
            .where(
                OrganizationMembership.organization_id == org_id,
                Role.name == "owner",
            )
        )
        owners = owner_count.scalars().all()
        if len(owners) <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot demote the last owner",
            )

    role_result = await db.execute(
        select(Role).where(
            Role.name == data.role_name,
            (Role.organization_id == org_id) | (Role.is_system == True),
        )
    )
    role = role_result.scalar_one_or_none()

    if not role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role '{data.role_name}' not found",
        )

    membership.role_id = role.id
    await db.commit()
    await db.refresh(membership)

    return MemberResponse(
        id=membership.id,
        user_id=membership.user.id,
        email=membership.user.email,
        display_name=membership.user.display_name,
        avatar_url=membership.user.avatar_url,
        role_id=role.id,
        role_name=role.name,
        joined_at=membership.joined_at,
    )


@router.get("/{org_id}/roles", response_model=list[RoleResponse])
async def list_roles(
    org_id: UUID,
    db: DbSession,
    permissions: PermissionServiceDep,
) -> list[RoleResponse]:
    await permissions.require_permission("org:read", org_id)

    result = await db.execute(
        select(Role)
        .options(selectinload(Role.permissions))
        .where(
            (Role.organization_id == org_id) | (Role.is_system == True)
        )
    )
    roles = result.scalars().all()

    return roles


@router.post("/{org_id}/roles", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
async def create_role(
    org_id: UUID,
    data: RoleCreate,
    db: DbSession,
    permissions: PermissionServiceDep,
) -> RoleResponse:
    await permissions.require_permission("role:create", org_id)

    existing = await db.execute(
        select(Role).where(
            Role.name == data.name,
            Role.organization_id == org_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Role with this name already exists in this organization",
        )

    perm_result = await db.execute(
        select(Permission).where(Permission.code.in_(data.permission_codes))
    )
    permissions_list = perm_result.scalars().all()

    if len(permissions_list) != len(data.permission_codes):
        found_codes = {p.code for p in permissions_list}
        invalid = set(data.permission_codes) - found_codes
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid permission codes: {invalid}",
        )

    role = Role(
        organization_id=org_id,
        name=data.name,
        is_system=False,
        permissions=permissions_list,
    )
    db.add(role)
    await db.commit()
    await db.refresh(role)

    return role


@router.put("/{org_id}/roles/{role_id}", response_model=RoleResponse)
async def update_role(
    org_id: UUID,
    role_id: UUID,
    data: RoleUpdate,
    db: DbSession,
    permissions: PermissionServiceDep,
) -> RoleResponse:
    await permissions.require_permission("role:update", org_id)

    result = await db.execute(
        select(Role)
        .options(selectinload(Role.permissions))
        .where(
            Role.id == role_id,
            Role.organization_id == org_id,
        )
    )
    role = result.scalar_one_or_none()

    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found",
        )

    if role.is_system:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot modify system roles",
        )

    if data.name is not None:
        role.name = data.name

    if data.permission_codes is not None:
        perm_result = await db.execute(
            select(Permission).where(Permission.code.in_(data.permission_codes))
        )
        permissions_list = perm_result.scalars().all()

        if len(permissions_list) != len(data.permission_codes):
            found_codes = {p.code for p in permissions_list}
            invalid = set(data.permission_codes) - found_codes
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid permission codes: {invalid}",
            )

        role.permissions = permissions_list

    await db.commit()
    await db.refresh(role)

    return role


@router.delete("/{org_id}/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role(
    org_id: UUID,
    role_id: UUID,
    db: DbSession,
    permissions: PermissionServiceDep,
) -> None:
    await permissions.require_permission("role:delete", org_id)

    result = await db.execute(
        select(Role).where(
            Role.id == role_id,
            Role.organization_id == org_id,
        )
    )
    role = result.scalar_one_or_none()

    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found",
        )

    if role.is_system:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete system roles",
        )

    members_with_role = await db.execute(
        select(OrganizationMembership).where(OrganizationMembership.role_id == role_id)
    )
    if members_with_role.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete role that is assigned to members",
        )

    await db.delete(role)
    await db.commit()
