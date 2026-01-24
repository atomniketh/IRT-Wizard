from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.deps import DbSession, CurrentUser
from app.models import User
from app.schemas.user import UserMeResponse, UserUpdate, UserResponse

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserMeResponse)
async def get_current_user_profile(
    current_user: CurrentUser,
) -> UserMeResponse:
    return current_user


@router.put("/me", response_model=UserMeResponse)
async def update_current_user_profile(
    data: UserUpdate,
    db: DbSession,
    current_user: CurrentUser,
) -> UserMeResponse:
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(current_user, key, value)

    await db.commit()
    await db.refresh(current_user)

    return current_user


@router.get("", response_model=list[UserResponse])
async def list_users(
    db: DbSession,
    current_user: CurrentUser,
) -> list[UserResponse]:
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Superuser access required",
        )

    result = await db.execute(select(User).where(User.is_active == True))
    return result.scalars().all()


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: UUID,
    db: DbSession,
    current_user: CurrentUser,
) -> UserResponse:
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Superuser access required",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return user


@router.put("/{user_id}/superuser", response_model=UserResponse)
async def set_superuser_status(
    user_id: UUID,
    is_superuser: bool,
    db: DbSession,
    current_user: CurrentUser,
) -> UserResponse:
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Superuser access required",
        )

    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot modify your own superuser status",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    user.is_superuser = is_superuser
    await db.commit()
    await db.refresh(user)

    return user


@router.put("/{user_id}/active", response_model=UserResponse)
async def set_user_active_status(
    user_id: UUID,
    is_active: bool,
    db: DbSession,
    current_user: CurrentUser,
) -> UserResponse:
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Superuser access required",
        )

    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate yourself",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    user.is_active = is_active
    await db.commit()
    await db.refresh(user)

    return user
