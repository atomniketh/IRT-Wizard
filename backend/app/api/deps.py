from typing import Annotated, AsyncGenerator

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    from app.models import async_session_maker

    async with async_session_maker() as session:
        try:
            yield session
        finally:
            await session.close()


SettingsDep = Annotated[Settings, Depends(get_settings)]
DbSession = Annotated[AsyncSession, Depends(get_db)]
