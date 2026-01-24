from fastapi import APIRouter

from app.api.deps import DbSession, CurrentUser
from app.schemas.user import UserMeResponse, UserUpdate

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
