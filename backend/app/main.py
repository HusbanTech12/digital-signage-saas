from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routes import dev, health, locations, me, organizations, pairing, screens
from db import models as _models  # noqa: F401 — register metadata for Alembic


@asynccontextmanager
async def lifespan(_app: FastAPI):
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router)
    app.include_router(me.router)
    app.include_router(organizations.router)
    app.include_router(locations.router)
    app.include_router(screens.router)
    app.include_router(pairing.router)
    app.include_router(dev.router)

    return app


app = create_app()
