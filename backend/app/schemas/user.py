from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr


class UserBase(BaseModel):
    email: EmailStr
    display_name: str | None = None
    avatar_url: str | None = None


class UserCreate(UserBase):
    external_id: str
    auth_provider: str = "dev"


class UserUpdate(BaseModel):
    display_name: str | None = None
    avatar_url: str | None = None


class UserResponse(UserBase):
    id: UUID
    external_id: str
    auth_provider: str
    is_active: bool
    is_superuser: bool
    created_at: datetime
    last_login_at: datetime | None

    class Config:
        from_attributes = True


class UserMeResponse(UserResponse):
    pass
