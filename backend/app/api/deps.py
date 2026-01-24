from typing import Annotated, AsyncGenerator
from uuid import UUID
from datetime import datetime

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import Settings, get_settings
from app.middleware.auth import AuthProvider, get_auth_provider
from app.models import User, Organization, OrganizationMembership


security = HTTPBearer(auto_error=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    from app.models import async_session_maker

    async with async_session_maker() as session:
        try:
            yield session
        finally:
            await session.close()


async def get_current_user(
    db: Annotated[AsyncSession, Depends(get_db)],
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
    auth_provider: Annotated[AuthProvider, Depends(get_auth_provider)],
) -> User:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        token_data = await auth_provider.verify_token(credentials.credentials)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    external_id = auth_provider.get_external_id(token_data)

    result = await db.execute(
        select(User).where(User.external_id == external_id)
    )
    user = result.scalar_one_or_none()

    if user is None:
        email = auth_provider.get_email(token_data)
        if not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email is required for user creation",
            )

        existing_email = await db.execute(
            select(User).where(User.email == email)
        )
        if existing_email.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User with this email already exists",
            )

        settings = get_settings()
        user = User(
            external_id=external_id,
            auth_provider=settings.auth_provider,
            email=email,
            display_name=auth_provider.get_display_name(token_data),
            avatar_url=auth_provider.get_avatar_url(token_data),
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled",
        )

    user.last_login_at = datetime.utcnow()
    await db.commit()

    return user


async def get_current_user_optional(
    db: Annotated[AsyncSession, Depends(get_db)],
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
    auth_provider: Annotated[AuthProvider, Depends(get_auth_provider)],
) -> User | None:
    if credentials is None:
        return None

    try:
        return await get_current_user(db, credentials, auth_provider)
    except HTTPException:
        return None


async def get_current_organization(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    x_organization_id: Annotated[str | None, Header()] = None,
) -> Organization | None:
    if x_organization_id is None:
        return None

    try:
        org_id = UUID(x_organization_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid organization ID format",
        )

    result = await db.execute(
        select(Organization).where(Organization.id == org_id, Organization.is_active == True)
    )
    organization = result.scalar_one_or_none()

    if organization is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    membership_result = await db.execute(
        select(OrganizationMembership).where(
            OrganizationMembership.user_id == current_user.id,
            OrganizationMembership.organization_id == org_id,
        )
    )
    membership = membership_result.scalar_one_or_none()

    if membership is None and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this organization",
        )

    return organization


SettingsDep = Annotated[Settings, Depends(get_settings)]
DbSession = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]
CurrentUserOptional = Annotated[User | None, Depends(get_current_user_optional)]
CurrentOrganization = Annotated[Organization | None, Depends(get_current_organization)]
