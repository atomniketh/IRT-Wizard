from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings

settings = get_settings()

engine = create_async_engine(settings.database_url, echo=settings.debug)
async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


from app.models.project import Project
from app.models.dataset import Dataset
from app.models.analysis import Analysis
from app.models.user_settings import UserSettings

__all__ = ["Base", "Project", "Dataset", "Analysis", "UserSettings", "async_session_maker", "engine"]
