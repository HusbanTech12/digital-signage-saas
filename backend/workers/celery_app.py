"""Celery application — broker/backend = REDIS_URL."""

from celery import Celery
from celery.schedules import crontab

from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "signage",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["workers.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    broker_connection_timeout=2,
    broker_connection_retry=False,
    broker_connection_retry_on_startup=False,
    broker_transport_options={
        "socket_connect_timeout": 2,
        "socket_timeout": 2,
    },
    beat_schedule={
        "apply-due-themes": {
            "task": "workers.tasks.apply_due_themes_task",
            "schedule": 60.0,
        },
        "mark-stale-screens-offline": {
            "task": "workers.tasks.mark_stale_screens_offline_task",
            "schedule": 30.0,
        },
        # Keep a combined tick as a safety net every 2 minutes
        "scheduler-combined-tick": {
            "task": "workers.tasks.run_scheduler_tick_task",
            "schedule": crontab(minute="*/2"),
        },
    },
)
