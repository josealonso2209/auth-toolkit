from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import require_role
from app.models.db import AdminUser, Webhook, WebhookDelivery
from app.models.schemas import (
    MessageResponse,
    WebhookCreate,
    WebhookDeliveryResponse,
    WebhookResponse,
    WebhookUpdate,
)
from app.services import audit, webhook as webhook_service

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])

VALID_EVENTS = [
    "token.generated",
    "token.revoked",
    "token.expired",
    "token.expiring_soon",
    "service.registered",
    "service.deleted",
]


@router.get("", response_model=list[WebhookResponse])
async def list_webhooks(
    user: AdminUser = Depends(require_role("admin", "operator")),
    db: Session = Depends(get_db),
):
    return db.query(Webhook).order_by(Webhook.created_at.desc()).all()


@router.post("", response_model=WebhookResponse, status_code=201)
async def create_webhook(
    data: WebhookCreate,
    request: Request,
    user: AdminUser = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    invalid = [e for e in data.events if e not in VALID_EVENTS]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Eventos invalidos: {', '.join(invalid)}")

    wh = Webhook(
        name=data.name,
        url=data.url,
        secret=data.secret,
        events=data.events,
        created_by=user.id,
    )
    db.add(wh)
    db.commit()
    db.refresh(wh)

    audit.log_action(
        db,
        actor_id=user.id,
        actor_username=user.username,
        action="webhook.create",
        resource_type="webhook",
        resource_id=str(wh.id),
        detail={"name": wh.name, "url": wh.url, "events": wh.events},
        ip_address=request.client.host if request.client else None,
    )

    return wh


@router.put("/{webhook_id}", response_model=WebhookResponse)
async def update_webhook(
    webhook_id: int,
    data: WebhookUpdate,
    request: Request,
    user: AdminUser = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    wh = db.query(Webhook).filter(Webhook.id == webhook_id).first()
    if not wh:
        raise HTTPException(status_code=404, detail="Webhook no encontrado")

    changes = {}
    if data.name is not None:
        wh.name = data.name
        changes["name"] = data.name
    if data.url is not None:
        wh.url = data.url
        changes["url"] = data.url
    if data.secret is not None:
        wh.secret = data.secret
        changes["secret"] = "***"
    if data.events is not None:
        invalid = [e for e in data.events if e not in VALID_EVENTS]
        if invalid:
            raise HTTPException(status_code=400, detail=f"Eventos invalidos: {', '.join(invalid)}")
        wh.events = data.events
        changes["events"] = data.events
    if data.is_active is not None:
        wh.is_active = data.is_active
        changes["is_active"] = data.is_active

    db.commit()
    db.refresh(wh)

    audit.log_action(
        db,
        actor_id=user.id,
        actor_username=user.username,
        action="webhook.update",
        resource_type="webhook",
        resource_id=str(webhook_id),
        detail=changes,
        ip_address=request.client.host if request.client else None,
    )

    return wh


@router.delete("/{webhook_id}", response_model=MessageResponse)
async def delete_webhook(
    webhook_id: int,
    request: Request,
    user: AdminUser = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    wh = db.query(Webhook).filter(Webhook.id == webhook_id).first()
    if not wh:
        raise HTTPException(status_code=404, detail="Webhook no encontrado")

    name = wh.name
    db.delete(wh)
    db.commit()

    audit.log_action(
        db,
        actor_id=user.id,
        actor_username=user.username,
        action="webhook.delete",
        resource_type="webhook",
        resource_id=str(webhook_id),
        detail={"name": name},
        ip_address=request.client.host if request.client else None,
    )

    return MessageResponse(message=f"Webhook {name} eliminado")


@router.get("/{webhook_id}/deliveries", response_model=list[WebhookDeliveryResponse])
async def list_deliveries(
    webhook_id: int,
    limit: int = 20,
    user: AdminUser = Depends(require_role("admin", "operator")),
    db: Session = Depends(get_db),
):
    wh = db.query(Webhook).filter(Webhook.id == webhook_id).first()
    if not wh:
        raise HTTPException(status_code=404, detail="Webhook no encontrado")

    return (
        db.query(WebhookDelivery)
        .filter(WebhookDelivery.webhook_id == webhook_id)
        .order_by(WebhookDelivery.delivered_at.desc())
        .limit(limit)
        .all()
    )


@router.post("/{webhook_id}/deliveries/{delivery_id}/retry", response_model=WebhookDeliveryResponse)
async def retry_delivery(
    webhook_id: int,
    delivery_id: int,
    request: Request,
    user: AdminUser = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Reintenta una entrega previa de un webhook. Util cuando el endpoint estuvo caido."""
    wh = db.query(Webhook).filter(Webhook.id == webhook_id).first()
    if not wh:
        raise HTTPException(status_code=404, detail="Webhook no encontrado")

    delivery = (
        db.query(WebhookDelivery)
        .filter(
            WebhookDelivery.id == delivery_id,
            WebhookDelivery.webhook_id == webhook_id,
        )
        .first()
    )
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery no encontrada")

    new_delivery = await webhook_service.retry_delivery(
        db, wh, delivery.event, delivery.payload or {}
    )
    if not new_delivery:
        raise HTTPException(status_code=500, detail="No se pudo crear la nueva delivery")

    audit.log_action(
        db,
        actor_id=user.id,
        actor_username=user.username,
        action="webhook.retry",
        resource_type="webhook_delivery",
        resource_id=str(new_delivery.id),
        detail={
            "webhook_id": webhook_id,
            "webhook_name": wh.name,
            "original_delivery_id": delivery_id,
            "event": delivery.event,
            "success": new_delivery.success,
            "response_status": new_delivery.response_status,
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent"),
    )

    return new_delivery
