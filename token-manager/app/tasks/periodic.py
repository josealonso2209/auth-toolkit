"""Tareas periodicas de Celery Beat: expiracion de tokens, limpieza."""

import json
import logging
from datetime import datetime, timedelta, timezone

import httpx

from app.celery_app import celery
from app.core.config import settings
from app.core.database import SessionLocal
from app.models.db import AdminSession, Webhook, WebhookDelivery

logger = logging.getLogger("token-manager.celery.periodic")

_TIMEOUT = 10.0
_EXPIRING_SOON_THRESHOLD = 900  # 15 minutos


def _fire_event_sync(db, event: str, payload: dict):
    """Dispara un evento de webhook de forma sincrona (para uso en tareas periodicas)."""
    from app.tasks.webhook_tasks import deliver_webhook

    webhooks = (
        db.query(Webhook)
        .filter(Webhook.is_active == True, Webhook.events.contains([event]))
        .all()
    )

    payload_json = json.dumps(payload, default=str)
    for wh in webhooks:
        deliver_webhook.delay(wh.id, event, payload, payload_json)


@celery.task(name="app.tasks.periodic.check_token_expiration")
def check_token_expiration():
    """Consulta tokens activos y dispara eventos token.expiring_soon / token.expired."""
    try:
        with httpx.Client(base_url=settings.auth_service_url, timeout=_TIMEOUT) as client:
            resp = client.get("/api/v1/tokens/active")
            if resp.status_code != 200:
                logger.error("No se pudo consultar tokens activos: %s", resp.status_code)
                return

            tokens = resp.json().get("tokens", [])
    except Exception as e:
        logger.error("Error consultando auth-service: %s", e)
        return

    if not tokens:
        return

    db = SessionLocal()
    try:
        expiring_soon = 0
        expired = 0

        for token in tokens:
            ttl = token.get("ttl_seconds", 0)
            service_id = token.get("service_id", "")
            token_id = token.get("token_id", "")

            if ttl <= 0:
                # TTL expirado pero Redis aun no lo limpio
                _fire_event_sync(db, "token.expired", {
                    "token_id": token_id,
                    "service_id": service_id,
                    "service_name": token.get("service_name", ""),
                    "expired_at": datetime.now(timezone.utc).isoformat(),
                })
                expired += 1
            elif ttl <= _EXPIRING_SOON_THRESHOLD:
                _fire_event_sync(db, "token.expiring_soon", {
                    "token_id": token_id,
                    "service_id": service_id,
                    "service_name": token.get("service_name", ""),
                    "ttl_seconds": ttl,
                    "expires_at": token.get("expires_at", ""),
                })
                expiring_soon += 1

        if expired or expiring_soon:
            logger.info(
                "Token expiration check: %d expired, %d expiring soon",
                expired, expiring_soon,
            )
    finally:
        db.close()


@celery.task(name="app.tasks.periodic.cleanup_expired_sessions")
def cleanup_expired_sessions():
    """Elimina sesiones admin expiradas o inactivas."""
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        deleted = (
            db.query(AdminSession)
            .filter(
                (AdminSession.expires_at < now) | (AdminSession.is_active == False)
            )
            .delete(synchronize_session=False)
        )
        db.commit()
        if deleted:
            logger.info("Cleaned up %d expired/inactive sessions", deleted)
    finally:
        db.close()


@celery.task(name="app.tasks.periodic.cleanup_old_deliveries")
def cleanup_old_deliveries():
    """Elimina webhook deliveries de mas de 30 dias."""
    db = SessionLocal()
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(days=30)
        deleted = (
            db.query(WebhookDelivery)
            .filter(WebhookDelivery.delivered_at < cutoff)
            .delete(synchronize_session=False)
        )
        db.commit()
        if deleted:
            logger.info("Cleaned up %d old webhook deliveries (>30 days)", deleted)
    finally:
        db.close()
