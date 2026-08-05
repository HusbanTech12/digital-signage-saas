"""Clerk JWT verification for FastAPI dependencies."""

from dataclasses import dataclass
from typing import Any

import jwt
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from db.models import User
from db.session import get_db

_bearer = HTTPBearer(auto_error=False)
_jwk_client: PyJWKClient | None = None


def _get_jwk_client() -> PyJWKClient:
    global _jwk_client
    settings = get_settings()
    jwks_url = settings.resolved_jwks_url
    if not jwks_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Clerk JWKS URL is not configured",
        )
    if _jwk_client is None:
        _jwk_client = PyJWKClient(jwks_url, cache_keys=True)
    return _jwk_client


@dataclass
class ClerkClaims:
    sub: str
    email: str | None
    raw: dict[str, Any]


def verify_clerk_token(token: str) -> ClerkClaims:
    settings = get_settings()
    try:
        signing_key = _get_jwk_client().get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={"verify_aud": False},
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Clerk token: {exc}",
        ) from exc

    sub = payload.get("sub")
    if not sub or not isinstance(sub, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Clerk token missing subject",
        )

    email = payload.get("email") or payload.get("primary_email_address")
    return ClerkClaims(sub=sub, email=email if isinstance(email, str) else None, raw=payload)


def _dev_bypass_claims(token: str) -> ClerkClaims | None:
    settings = get_settings()
    if not settings.dev_auth_bypass:
        return None
    if settings.app_env not in ("development", "dev", "local"):
        return None
    if not token.startswith("dev:"):
        return None
    clerk_user_id = token.removeprefix("dev:").strip()
    if not clerk_user_id:
        return None
    return ClerkClaims(sub=clerk_user_id, email=None, raw={"dev": True})


async def get_clerk_claims(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    x_dev_clerk_user_id: str | None = Header(default=None, alias="X-Dev-Clerk-User-Id"),
) -> ClerkClaims:
    settings = get_settings()

    if credentials is not None and credentials.scheme.lower() == "bearer":
        bypass = _dev_bypass_claims(credentials.credentials)
        if bypass is not None:
            return bypass
        return verify_clerk_token(credentials.credentials)

    if (
        settings.dev_auth_bypass
        and settings.app_env in ("development", "dev", "local")
        and x_dev_clerk_user_id
    ):
        return ClerkClaims(
            sub=x_dev_clerk_user_id.strip(),
            email=None,
            raw={"dev": True},
        )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Missing Bearer token",
    )


async def get_current_user(
    claims: ClerkClaims = Depends(get_clerk_claims),
    db: AsyncSession = Depends(get_db),
) -> User:
    result = await db.execute(
        select(User).where(User.clerk_user_id == claims.sub)
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not provisioned in this API. Complete onboarding first.",
        )
    return user
