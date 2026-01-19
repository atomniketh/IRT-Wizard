import uuid
from typing import TYPE_CHECKING

import boto3
from botocore.config import Config

if TYPE_CHECKING:
    from app.config import Settings


class StorageService:
    def __init__(self, settings: "Settings"):
        self.settings = settings
        self.client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint_url,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
            config=Config(signature_version="s3v4"),
        )
        self.bucket = settings.s3_bucket
        self._ensure_bucket()

    def _ensure_bucket(self) -> None:
        try:
            self.client.head_bucket(Bucket=self.bucket)
        except Exception:
            try:
                self.client.create_bucket(Bucket=self.bucket)
            except Exception:
                pass

    async def upload_file(self, content: bytes, filename: str, project_id: str) -> str:
        file_id = str(uuid.uuid4())
        key = f"{project_id}/{file_id}/{filename}"
        self.client.put_object(Bucket=self.bucket, Key=key, Body=content)
        return key

    async def download_file(self, file_path: str) -> bytes:
        response = self.client.get_object(Bucket=self.bucket, Key=file_path)
        return response["Body"].read()

    async def delete_file(self, file_path: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=file_path)

    async def file_exists(self, file_path: str) -> bool:
        try:
            self.client.head_object(Bucket=self.bucket, Key=file_path)
            return True
        except Exception:
            return False
