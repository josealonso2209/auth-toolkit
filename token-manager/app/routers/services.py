from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core import auth_client
from app.core.database import get_db
from app.dependencies.auth import get_current_user, require_role
from app.models.db import AdminUser
import secrets

from app.models.schemas import BulkRegisterRequest, MessageResponse, ServiceRegisterRequest
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
    client_id = data.client_id or f"{data.service_id}-client"
    client_secret = data.client_secret or secrets.token_urlsafe(32)

    success = await auth_client.register_service(
        service_id=data.service_id,
        service_name=data.service_name,
        client_id=client_id,
        client_secret=client_secret,
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

    webhook.fire_event(db, "service.registered", {
        "service_id": data.service_id,
        "service_name": data.service_name,
        "registered_by": user.username,
    })

    return {
        "success": True,
        "message": f"Servicio {data.service_id} registrado",
        "service_id": data.service_id,
        "client_id": client_id,
        "client_secret": client_secret,
    }


@router.post("/bulk-register")
async def bulk_register_devices(
    data: BulkRegisterRequest,
    request: Request,
    user: AdminUser = Depends(require_role("admin", "operator")),
    db: Session = Depends(get_db),
):
    """Registra multiples dispositivos IoT/edge como servicios de golpe."""
    results = []
    for dev in data.devices:
        sid = f"{data.prefix}-{dev.device_id}"
        cid = f"{sid}-client"
        csecret = secrets.token_urlsafe(32)
        try:
            ok = await auth_client.register_service(
                service_id=sid,
                service_name=dev.device_name,
                client_id=cid,
                client_secret=csecret,
                description=f"IoT device: {dev.device_name}",
                allowed_scopes=dev.scopes,
                rate_limit=dev.rate_limit,
            )
            results.append({
                "device_id": dev.device_id,
                "service_id": sid,
                "client_id": cid,
                "client_secret": csecret,
                "success": ok,
            })
            if ok:
                audit.log_action(
                    db,
                    actor_id=user.id,
                    actor_username=user.username,
                    action="service.register",
                    resource_type="service",
                    resource_id=sid,
                    detail={
                        "service_name": dev.device_name,
                        "bulk": True,
                        "prefix": data.prefix,
                        "allowed_scopes": dev.scopes,
                    },
                    ip_address=request.client.host if request.client else None,
                    user_agent=request.headers.get("User-Agent"),
                )
        except Exception:
            results.append({
                "device_id": dev.device_id,
                "service_id": sid,
                "client_id": cid,
                "client_secret": csecret,
                "success": False,
            })

    registered = sum(1 for r in results if r["success"])
    webhook.fire_event(db, "service.bulk_registered", {
        "prefix": data.prefix,
        "total": len(data.devices),
        "registered": registered,
        "registered_by": user.username,
    })

    return {"success": True, "registered": registered, "total": len(data.devices), "devices": results}


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

    webhook.fire_event(db, "service.deleted", {
        "service_id": service_id,
        "deleted_by": user.username,
    })

    return {"success": True, "message": f"Servicio {service_id} eliminado"}


@router.post("/{service_id}/lock")
async def lock_service(
    service_id: str,
    request: Request,
    user: AdminUser = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Bloquea un servicio: deja de poder pedir nuevos tokens."""
    ok = await auth_client.lock_service(service_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")

    audit.log_action(
        db,
        actor_id=user.id,
        actor_username=user.username,
        action="service.lock",
        resource_type="service",
        resource_id=service_id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent"),
    )

    webhook.fire_event(db, "service.locked", {
        "service_id": service_id,
        "locked_by": user.username,
    })

    return {"success": True, "message": f"Servicio {service_id} bloqueado"}


@router.post("/{service_id}/unlock")
async def unlock_service(
    service_id: str,
    request: Request,
    user: AdminUser = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Reactiva un servicio bloqueado."""
    ok = await auth_client.unlock_service(service_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")

    audit.log_action(
        db,
        actor_id=user.id,
        actor_username=user.username,
        action="service.unlock",
        resource_type="service",
        resource_id=service_id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent"),
    )

    webhook.fire_event(db, "service.unlocked", {
        "service_id": service_id,
        "unlocked_by": user.username,
    })

    return {"success": True, "message": f"Servicio {service_id} desbloqueado"}


@router.post("/{service_id}/revoke-all")
async def revoke_all_service_tokens(
    service_id: str,
    request: Request,
    user: AdminUser = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Kill switch: revoca todos los tokens activos de un servicio."""
    revoked = await auth_client.revoke_all_tokens(service_id)

    audit.log_action(
        db,
        actor_id=user.id,
        actor_username=user.username,
        action="token.revoke_all",
        resource_type="service",
        resource_id=service_id,
        detail={"revoked_count": revoked},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent"),
    )

    webhook.fire_event(db, "token.revoked_all", {
        "service_id": service_id,
        "revoked_count": revoked,
        "revoked_by": user.username,
    })

    return {
        "success": True,
        "message": f"{revoked} tokens revocados",
        "revoked_count": revoked,
    }
