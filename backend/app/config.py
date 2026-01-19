from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "IRT Wizard"
    debug: bool = False

    database_url: str = "postgresql+asyncpg://irt_user:irt_password@localhost:5432/irt_wizard"

    s3_endpoint_url: str = "http://localhost:8333"
    s3_access_key: str = "mlflow"
    s3_secret_key: str = "mlflow-secret"
    s3_bucket: str = "irt-data"

    mlflow_tracking_uri: str = "http://localhost:5000"

    max_upload_size_mb: int = 100
    max_rows_preview: int = 10


@lru_cache
def get_settings() -> Settings:
    return Settings()
