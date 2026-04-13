"""Tareas Celery para entrega de webhooks en background."""

import hashlib
import hmac
import logging
import time

import httpx

from app.celery_app import celery
from app.core.database import SessionLocal
from app.models.db import Webhook, WebhookDelivery

logger = logging.getLogger("token-manager.celery.webhooks")

_TIMEOUT = 10.0
_MAX_RETRIES = 3


def _sign_payload(payload_json: str, secret: str) -> str:
    return hmac.new(secret.encode(), payload_json.encode(), hashlib.sha256).hexdigest()


def _do_deliver(db, webhook: Webhook, event: str, payload: dict, payload_json: str) -> bool:
    """Entrega sincrona con reintentos internos. Persiste cada intento en DB."""
    headers = {"Content-Type": "application/json", "X-Webhook-Event": event}

    if webhook.secret:
        signature = _sign_payload(payload_json, webhook.secret)
        headers["X-Webhook-Signature"] = f"sha256={signature}"

    for attempt in range(1, _MAX_RETRIES + 1):
        start = time.monotonic()
        delivery = WebhookDelivery(
            webhook_id=webhook.id,
            event=event,
            payload=payload,
            attempt=attempt,
        )

        try:
            with httpx.Client(timeout=_TIMEOUT) as client:
                resp = client.post(webhook.url, content=payload_json, headers=headers)

            duration = int((time.monotonic() - start) * 1000)
            delivery.response_status = resp.status_code
            delivery.response_body = resp.text[:2000]
            delivery.duration_ms = duration
            delivery.success = 200 <= resp.status_code < 300

            db.add(delivery)
            db.commit()

            if delivery.success:
                logger.info("Webhook %s delivered: %s (attempt %d)", webhook.name, event, attempt)
                return True

            logger.warning(
                "Webhook %s failed: %s status=%d (attempt %d)",
                webhook.name, event, resp.status_code, attempt,
            )

        except Exception as e:
            duration = int((time.monotonic() - start) * 1000)
            delivery.response_body = str(e)[:2000]
            delivery.duration_ms = duration
            delivery.success = False
            db.add(delivery)
            db.commit()
            logger.error("Webhook %s error: %s (attempt %d): %s", webhook.name, event, attempt, e)

    return False


@celery.task(name="app.tasks.webhook_tasks.deliver_webhook")
def deliver_webhook(webhook_id: int, event: str, payload: dict, payload_json: str):
    """Tarea Celery: entrega un webhook individual en background."""
    db = SessionLocal()
    try:
        webhook = db.query(Webhook).filter(Webhook.id == webhook_id).first()
        if not webhook or not webhook.is_active:
            logger.info("Webhook %d no encontrado o inactivo, saltando", webhook_id)
            return

        _do_deliver(db, webhook, event, payload, payload_json)
    finally:
        db.close()
