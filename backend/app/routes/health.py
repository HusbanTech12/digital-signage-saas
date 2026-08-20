import logging

from fastapi import APIRouter
from sqlalchemy import text

from app.config import get_settings
from app.schemas.health import HealthResponse
from db.session import AsyncSessionLocal

logger = logging.getLogger(__name__)
router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    settings = get_settings()
    db_status = "ok"
    if settings.app_env == "production" and settings.database_host_is_local:
        db_status = "misconfigured_localhost"
    else:
        try:
            async with AsyncSessionLocal() as session:
                await session.execute(text("SELECT 1"))
        except Exception as exc:  # noqa: BLE001
            db_status = "unreachable"
            logger.warning("Health DB check failed: %s: %s", type(exc).__name__, exc)

    return HealthResponse(
        status="ok" if db_status == "ok" else "degraded",
        app=settings.app_name,
        env=settings.app_env,
        database=db_status,
    )
