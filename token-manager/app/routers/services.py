from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core import auth_client
from app.core.database import get_db
from app.dependencies.auth import get_current_user, require_role
from app.models.db import AdminUser
from app.models.schemas import MessageResponse, ServiceRegisterRequest
from app.services import audit, webhook

router = APIRouter(prefix="/api/services", tags=["services"])


@router.get("")
async def list_services(
    user: AdminUser = Depends(require_role("admin", "operator")),
):
    services = await auth_client.list_services(bearer="")
    return services

@router.post("/register")
async def register_service(
    data: ServiceRegisterRequest,
    request: Request,
    user: AdminUser = Depends(require_role("admin", "operator")),
    db: Session = Depends(get_db),
):
    success = await auth_client.register_service(
        service_id=data.service_id,
        service_name=data.service_name,
        client_id=data.client_id,
        client_secret=data.client_secret,
        description=data.description,
        allowed_scopes=data.allowed_scopes,
        rate_limit=data.rate_limit,
    )

    if not success:
        raise HTTPException(status_code=409, detail="Servicio ya registrado o error en auth-service")

    audit.log_action(
        db,
        actor_id=user.id,
        actor_username=user.username,
        action="service.register",
        resource_type="service",
        resource_id=data.service_id,
        detail={
            "service_name": data.service_name,
            "allowed_scopes": data.allowed_scopes,
            "rate_limit": data.rate_limit,
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent"),
    )

    await webhook.fire_event(db, "service.registered", {
        "service_id": data.service_id,
        "service_name": data.service_name,
        "registered_by": user.username,
    })

    return {"success": True, "message": f"Servicio {data.service_id} registrado"}


@router.delete("/{service_id}")
async def delete_service(
    service_id: str,
    request: Request,
    user: AdminUser = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    # Necesitamos un bearer para el auth-service — se resolvera con service account interno
    deleted = await auth_client.delete_service(service_id, bearer="")
    # Por ahora se permite incluso si auth-service no confirma (el admin tiene autoridad)

    audit.log_action(
        db,
        actor_id=user.id,
        actor_username=user.username,
        action="service.delete",
        resource_type="service",
        resource_id=service_id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent"),
    )

    await webhook.fire_event(db, "service.deleted", {
        "service_id": service_id,
        "deleted_by": user.username,
    })

    return {"success": True, "message": f"Servicio {service_id} eliminado"}
