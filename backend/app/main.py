import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routes import (
    dev,
    health,
    invitations,
    locations,
    me,
    media,
    menus,
    organizations,
    pairing,
    pos,
    screens,
    team,
    templates,
    themes,
    ws,
)
from app.schemas.display import RealtimeEvent
from app.services.realtime import get_realtime_hub
from app.services.theme_scheduler import run_scheduler_tick
from db import models as _models  # noqa: F401 — register metadata for Alembic

logger = logging.getLogger(__name__)


async def _inline_scheduler_loop(stop: asyncio.Event) -> None:
    settings = get_settings()
    hub = get_realtime_hub()
    interval = max(10, settings.inline_scheduler_interval_seconds)
    while not stop.is_set():
        try:
            events, via_redis, stats = await asyncio.to_thread(run_scheduler_tick)
            if events and not via_redis:
                for raw in events:
                    try:
                        await hub.publish_event(RealtimeEvent.model_validate(raw))
                    except Exception:  # noqa: BLE001
                        logger.debug("Local theme fan-out skipped", exc_info=True)
            if stats.get("offline_marked") or stats.get("theme_events"):
                logger.info("Inline scheduler tick: %s", stats)
        except Exception:  # noqa: BLE001
            logger.exception("Inline scheduler tick failed")
        try:
            await asyncio.wait_for(stop.wait(), timeout=interval)
        except asyncio.TimeoutError:
            pass


def _running_on_vercel() -> bool:
    import os

    return bool(os.getenv("VERCEL") or os.getenv("VERCEL_ENV"))


@asynccontextmanager
async def lifespan(_app: FastAPI):
    settings = get_settings()
    hub = get_realtime_hub()
    await hub.start()
    stop = asyncio.Event()
    scheduler_task: asyncio.Task[None] | None = None
    # Vercel Functions are request-scoped — background Beat loops are unreliable.
    use_inline = settings.inline_scheduler and not _running_on_vercel()
    if use_inline:
        scheduler_task = asyncio.create_task(
            _inline_scheduler_loop(stop), name="inline-scheduler"
        )
        logger.info(
            "Inline scheduler enabled (interval=%ss, offline_after=%ss)",
            settings.inline_scheduler_interval_seconds,
            settings.screen_offline_after_seconds,
        )
    elif _running_on_vercel():
        logger.info(
            "Vercel detected — inline scheduler off; use /themes/apply-now or external cron"
        )
    try:
        yield
    finally:
        stop.set()
        if scheduler_task is not None:
            scheduler_task.cancel()
            try:
                await scheduler_task
            except asyncio.CancelledError:
                pass
        await hub.stop()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        # Cover Vercel production + preview aliases for known web projects
        allow_origin_regex=(
            r"https://(digital-signage-web|digital-menu-brai|digital-menu)"
            r"(-[a-z0-9-]+)?\.vercel\.app"
        ),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router)
    app.include_router(me.router)
    app.include_router(organizations.router)
    app.include_router(locations.router)
    app.include_router(screens.router)
    app.include_router(ws.router)
    app.include_router(pairing.router)
    app.include_router(menus.router)
    app.include_router(templates.router)
    app.include_router(themes.router)
    app.include_router(pos.router)
    app.include_router(pos.webhook_router)
    app.include_router(team.router)
    app.include_router(invitations.router)
    app.include_router(media.router)
    app.include_router(dev.router)

    return app


app = create_app()
