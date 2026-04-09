"""Endpoints self-service para partners: gestion de API keys propias."""

import secrets

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core import auth_client
from app.core.database import get_db
from app.dependencies.auth import require_role
from app.models.db import AdminUser, ServiceOwnership
from app.models.schemas import PartnerKeyCreateRequest, PartnerKeyListItem, PartnerKeyResponse
from app.services import audit, webhook

router = APIRouter(prefix="/api/partner", tags=["partner"])

DEFAULT_QUOTA = {"max_services": 5, "max_rate_limit": 100, "allowed_scopes": ["read", "write"]}


def _get_quota(user: AdminUser) -> dict:
    return user.partner_quota or DEFAULT_QUOTA


@router.get("/keys", response_model=list[PartnerKeyListItem])
async def list_partner_keys(
    user: AdminUser = Depends(require_role("partner")),
    db: Session = Depends(get_db),
):
    owned = (
        db.query(ServiceOwnership.service_id)
        .filter(ServiceOwnership.owner_id == user.id)
        .all()
    )
    owned_ids = {row[0] for row in owned}
    if not owned_ids:
        return []

    all_services = await auth_client.list_services()
    return [
        PartnerKeyListItem(
            service_id=s["service_id"],
            service_name=s["service_name"],
            client_id=s["client_id"],
            scopes=s.get("allowed_scopes", []),
            rate_limit=s.get("rate_limit", 0),
            is_active=s.get("is_active", True),
            created_at=s.get("created_at", ""),
        )
        for s in all_services
        if s["service_id"] in owned_ids
    ]


@router.post("/keys", response_model=PartnerKeyResponse, status_code=201)
async def create_partner_key(
    data: PartnerKeyCreateRequest,
    request: Request,
    user: AdminUser = Depends(require_role("partner")),
    db: Session = Depends(get_db),
):
    quota = _get_quota(user)

    # Verificar cuota de servicios
    current_count = (
        db.query(ServiceOwnership)
        .filter(ServiceOwnership.owner_id == user.id)
        .count()
    )
    if current_count >= quota["max_services"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Cuota de servicios alcanzada ({quota['max_services']})",
        )

    # Validar scopes
    allowed = set(quota["allowed_scopes"])
    requested = set(data.scopes)
    invalid = requested - allowed
    if invalid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Scopes no permitidos: {', '.join(sorted(invalid))}",
        )

    # Validar rate limit
    if data.rate_limit > quota["max_rate_limit"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Rate limit maximo permitido: {quota['max_rate_limit']}",
        )

    # Generar credenciales
    suffix = secrets.token_hex(4)
    service_id = f"partner-{user.id}-{suffix}"
    client_id = f"{service_id}-client"
    client_secret = secrets.token_urlsafe(32)

    # Registrar en auth-service
    ok = await auth_client.register_service(
        service_id=service_id,
        service_name=data.service_name,
        client_id=client_id,
        client_secret=client_secret,
        description=data.description,
        allowed_scopes=data.scopes,
        rate_limit=data.rate_limit,
    )
    if not ok:
        raise HTTPException(status_code=502, detail="Error registrando servicio en auth-service")

    # Guardar ownership
    ownership = ServiceOwnership(service_id=service_id, owner_id=user.id)
    db.add(ownership)
    db.commit()

    # Auditoria
    audit.log_action(
        db,
        actor_id=user.id,
        actor_username=user.username,
        action="partner.key.create",
        resource_type="service",
        resource_id=service_id,
        detail={"service_name": data.service_name, "scopes": data.scopes, "rate_limit": data.rate_limit},
        ip_address=request.client.host if request.client else None,
    )

    # Webhook
    await webhook.fire_event(db, "partner.key.created", {
        "service_id": service_id,
        "partner": user.username,
        "service_name": data.service_name,
    })

    return PartnerKeyResponse(
        service_id=service_id,
        service_name=data.service_name,
        client_id=client_id,
        client_secret=client_secret,
        scopes=data.scopes,
        rate_limit=data.rate_limit,
        created_at=ownership.created_at.isoformat(),
    )


@router.delete("/keys/{service_id}")
async def delete_partner_key(
    service_id: str,
    request: Request,
    user: AdminUser = Depends(require_role("partner")),
    db: Session = Depends(get_db),
):
    ownership = (
        db.query(ServiceOwnership)
        .filter(ServiceOwnership.service_id == service_id, ServiceOwnership.owner_id == user.id)
        .first()
    )
    if not ownership:
        raise HTTPException(status_code=404, detail="API key no encontrada")

    await auth_client.delete_service(service_id)

    db.delete(ownership)
    db.commit()

    audit.log_action(
        db,
        actor_id=user.id,
        actor_username=user.username,
        action="partner.key.delete",
        resource_type="service",
        resource_id=service_id,
        ip_address=request.client.host if request.client else None,
    )

    await webhook.fire_event(db, "partner.key.deleted", {
        "service_id": service_id,
        "partner": user.username,
    })

    return {"success": True, "message": f"API key {service_id} revocada"}


@router.get("/quota")
async def get_partner_quota(
    user: AdminUser = Depends(require_role("partner")),
    db: Session = Depends(get_db),
):
    quota = _get_quota(user)
    used = (
        db.query(ServiceOwnership)
        .filter(ServiceOwnership.owner_id == user.id)
        .count()
    )
    return {
        "quota": quota,
        "usage": {"services_used": used},
    }
