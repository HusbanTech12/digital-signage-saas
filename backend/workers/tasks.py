"""Celery tasks for theme scheduling and offline detection."""

from __future__ import annotations

import logging

from workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="workers.tasks.apply_due_themes_task")
def apply_due_themes_task() -> dict:
    from app.services.theme_scheduler import apply_due_themes, _publish_events_redis
    from db.sync_session import SyncSessionLocal

    with SyncSessionLocal() as db:
        events = apply_due_themes(db)
        via_redis = _publish_events_redis(events) if events else True
    logger.info("apply_due_themes: events=%s redis=%s", len(events), via_redis)
    return {"events": len(events), "publishedViaRedis": via_redis}


@celery_app.task(name="workers.tasks.mark_stale_screens_offline_task")
def mark_stale_screens_offline_task() -> dict:
    from app.services.theme_scheduler import mark_stale_screens_offline
    from db.sync_session import SyncSessionLocal

    with SyncSessionLocal() as db:
        changed = mark_stale_screens_offline(db)
    logger.info("mark_stale_screens_offline: changed=%s", changed)
    return {"offlineMarked": changed}


@celery_app.task(name="workers.tasks.run_scheduler_tick_task")
def run_scheduler_tick_task() -> dict:
    from app.services.theme_scheduler import run_scheduler_tick

    events, via_redis, stats = run_scheduler_tick()
    return {
        "events": len(events),
        "publishedViaRedis": via_redis,
        **stats,
    }
