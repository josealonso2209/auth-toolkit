"""Motor de webhooks: dispara notificaciones HTTP ante eventos."""

import hashlib
import hmac
import json
import logging
import time

import httpx
from sqlalchemy.orm import Session

from app.models.db import Webhook, WebhookDelivery

logger = logging.getLogger("token-manager.webhooks")

_TIMEOUT = 10.0
_MAX_RETRIES = 3


def _sign_payload(payload: str, secret: str) -> str:
    return hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()


async def retry_delivery(db: Session, webhook: Webhook, event: str, payload: dict) -> WebhookDelivery | None:
    """Reintenta una entrega previa y devuelve la ultima nueva delivery creada.

    Reusa `_deliver`, que persiste cada intento (hasta `_MAX_RETRIES`) en la tabla.
    """
    last_id = (
        db.query(WebhookDelivery.id)
        .filter(WebhookDelivery.webhook_id == webhook.id)
        .order_by(WebhookDelivery.id.desc())
        .first()
    )
    last_id_value = last_id[0] if last_id else 0

    payload_json = json.dumps(payload, default=str)
    await _deliver(db, webhook, event, payload, payload_json)

    return (
        db.query(WebhookDelivery)
        .filter(
            WebhookDelivery.webhook_id == webhook.id,
            WebhookDelivery.id > last_id_value,
        )
        .order_by(WebhookDelivery.id.desc())
        .first()
    )


async def fire_event(db: Session, event: str, payload: dict) -> int:
    """Dispara un evento a todos los webhooks suscritos. Retorna cantidad de entregas exitosas."""
    webhooks = (
        db.query(Webhook)
        .filter(Webhook.is_active == True, Webhook.events.contains([event]))
        .all()
    )

    if not webhooks:
        return 0

    success_count = 0
    payload_json = json.dumps(payload, default=str)

    for wh in webhooks:
        delivered = await _deliver(db, wh, event, payload, payload_json)
        if delivered:
            success_count += 1

    return success_count


async def _deliver(
    db: Session,
    webhook: Webhook,
    event: str,
    payload: dict,
    payload_json: str,
) -> bool:
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
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                resp = await client.post(webhook.url, content=payload_json, headers=headers)

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
