from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from app.api.deps import DbSession
from app.models.user_settings import UserSettings


class SettingsUpdate(BaseModel):
    default_competency_level: str | None = None
    default_model_type: str | None = None
    theme: str | None = None
    show_advanced_stats: bool | None = None
    settings: dict[str, Any] | None = None


class SettingsResponse(BaseModel):
    default_competency_level: str
    default_model_type: str
    theme: str
    show_advanced_stats: bool
    settings: dict[str, Any] | None = None

    class Config:
        from_attributes = True


router = APIRouter()


@router.get("", response_model=SettingsResponse)
async def get_settings(db: DbSession) -> UserSettings:
    result = await db.execute(select(UserSettings).where(UserSettings.id == 1))
    settings = result.scalar_one_or_none()

    if not settings:
        settings = UserSettings(id=1)
        db.add(settings)
        await db.commit()
        await db.refresh(settings)

    return settings


@router.put("", response_model=SettingsResponse)
async def update_settings(settings_in: SettingsUpdate, db: DbSession) -> UserSettings:
    result = await db.execute(select(UserSettings).where(UserSettings.id == 1))
    settings = result.scalar_one_or_none()

    if not settings:
        settings = UserSettings(id=1)
        db.add(settings)

    update_data = settings_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(settings, field, value)

    await db.commit()
    await db.refresh(settings)
    return settings
