from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class OrganizationBase(BaseModel):
    name: str
    description: str | None = None


class OrganizationCreate(OrganizationBase):
    slug: str = Field(..., pattern=r"^[a-z0-9][a-z0-9-]*[a-z0-9]$", min_length=3, max_length=100)


class OrganizationUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    settings: dict | None = None


class OrganizationResponse(OrganizationBase):
    id: UUID
    slug: str
    settings: dict | None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class OrganizationListItem(BaseModel):
    id: UUID
    slug: str
    name: str
    role: str
    created_at: datetime

    class Config:
        from_attributes = True


class MembershipBase(BaseModel):
    role_id: UUID


class MemberInvite(BaseModel):
    email: str
    role_name: str = "member"


class MemberResponse(BaseModel):
    id: UUID
    user_id: UUID
    email: str
    display_name: str | None
    avatar_url: str | None
    role_id: UUID
    role_name: str
    joined_at: datetime

    class Config:
        from_attributes = True


class MemberRoleUpdate(BaseModel):
    role_name: str


class RoleBase(BaseModel):
    name: str


class RoleCreate(RoleBase):
    permission_codes: list[str]


class RoleUpdate(BaseModel):
    name: str | None = None
    permission_codes: list[str] | None = None


class PermissionResponse(BaseModel):
    id: UUID
    code: str
    name: str
    resource: str
    action: str

    class Config:
        from_attributes = True


class RoleResponse(RoleBase):
    id: UUID
    organization_id: UUID | None
    is_system: bool
    permissions: list[PermissionResponse]

    class Config:
        from_attributes = True
