"""Celery application — broker Redis, tareas autodescubiertas en app.tasks."""

from celery import Celery
from celery.schedules import crontab

from app.core.config import settings

celery = Celery("token-manager")

celery.conf.update(
    broker_url=settings.celery_broker_url,
    result_backend=settings.celery_result_backend,
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    broker_connection_retry_on_startup=True,
    worker_prefetch_multiplier=4,
    result_expires=3600,
    beat_schedule={
        "check-token-expiration": {
            "task": "app.tasks.periodic.check_token_expiration",
            "schedule": 300.0,  # cada 5 minutos
        },
        "cleanup-expired-sessions": {
            "task": "app.tasks.periodic.cleanup_expired_sessions",
            "schedule": crontab(minute=0),  # cada hora
        },
        "cleanup-old-deliveries": {
            "task": "app.tasks.periodic.cleanup_old_deliveries",
            "schedule": crontab(hour=3, minute=0),  # diario a las 3 AM UTC
        },
    },
)

celery.autodiscover_tasks(["app.tasks"])
