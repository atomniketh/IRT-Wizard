from abc import ABC, abstractmethod
from functools import lru_cache
from typing import Any
import httpx

from app.config import get_settings


class AuthProvider(ABC):
    @abstractmethod
    async def verify_token(self, token: str) -> dict[str, Any]:
        pass

    @abstractmethod
    def get_external_id(self, token_data: dict[str, Any]) -> str:
        pass

    @abstractmethod
    def get_email(self, token_data: dict[str, Any]) -> str | None:
        pass

    @abstractmethod
    def get_display_name(self, token_data: dict[str, Any]) -> str | None:
        pass

    @abstractmethod
    def get_avatar_url(self, token_data: dict[str, Any]) -> str | None:
        pass


class DevAuthProvider(AuthProvider):
    async def verify_token(self, token: str) -> dict[str, Any]:
        if not token:
            raise ValueError("Token is required")
        parts = token.split(":")
        external_id = parts[0]
        email = parts[1] if len(parts) > 1 else f"{external_id}@dev.local"
        display_name = parts[2] if len(parts) > 2 else external_id
        return {
            "sub": external_id,
            "email": email,
            "name": display_name,
        }

    def get_external_id(self, token_data: dict[str, Any]) -> str:
        return token_data["sub"]

    def get_email(self, token_data: dict[str, Any]) -> str | None:
        return token_data.get("email")

    def get_display_name(self, token_data: dict[str, Any]) -> str | None:
        return token_data.get("name")

    def get_avatar_url(self, token_data: dict[str, Any]) -> str | None:
        return None


class Auth0Provider(AuthProvider):
    def __init__(self, domain: str, audience: str):
        self.domain = domain
        self.audience = audience
        self._jwks: dict | None = None

    async def _get_jwks(self) -> dict:
        if self._jwks is None:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"https://{self.domain}/.well-known/jwks.json")
                response.raise_for_status()
                self._jwks = response.json()
        return self._jwks

    async def verify_token(self, token: str) -> dict[str, Any]:
        import jwt
        from jwt import PyJWKClient

        jwks_url = f"https://{self.domain}/.well-known/jwks.json"
        jwks_client = PyJWKClient(jwks_url)
        signing_key = jwks_client.get_signing_key_from_jwt(token)

        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=self.audience,
            issuer=f"https://{self.domain}/",
        )
        return payload

    def get_external_id(self, token_data: dict[str, Any]) -> str:
        return token_data["sub"]

    def get_email(self, token_data: dict[str, Any]) -> str | None:
        return token_data.get("email") or token_data.get(f"https://{self.domain}/email")

    def get_display_name(self, token_data: dict[str, Any]) -> str | None:
        return token_data.get("name") or token_data.get("nickname")

    def get_avatar_url(self, token_data: dict[str, Any]) -> str | None:
        return token_data.get("picture")


@lru_cache
def get_auth_provider() -> AuthProvider:
    settings = get_settings()
    if settings.auth_provider == "auth0":
        if not settings.auth0_domain or not settings.auth0_audience:
            raise ValueError("Auth0 domain and audience must be configured")
        return Auth0Provider(settings.auth0_domain, settings.auth0_audience)
    return DevAuthProvider()
