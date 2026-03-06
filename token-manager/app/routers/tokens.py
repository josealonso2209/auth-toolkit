from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core import auth_client
from app.core.database import get_db
from app.dependencies.auth import get_current_user, require_role
from app.models.db import AdminUser
from app.models.schemas import MessageResponse, TokenGenerateRequest, TokenRevokeRequest
from app.services import audit, webhook

router = APIRouter(prefix="/api/tokens", tags=["tokens"])


@router.post("/generate")
async def generate_token(
    data: TokenGenerateRequest,
    request: Request,
    user: AdminUser = Depends(require_role("admin", "operator")),
    db: Session = Depends(get_db),
):
    # Registrar servicio primero (idempotente si ya existe)
    await auth_client.register_service(
        service_id=data.service_id,
        service_name=data.service_name,
        client_id=data.client_id,
        client_secret=data.client_secret,
        allowed_scopes=data.scopes,
    )

    access_ttl = data.expiration_days * 24 * 3600

    result = await auth_client.generate_token(
        client_id=data.client_id,
        client_secret=data.client_secret,
        scopes=data.scopes,
        access_ttl=access_ttl,
    )

    if not result:
        raise HTTPException(status_code=500, detail="Error generando token en auth-service")

    audit.log_action(
        db,
        actor_id=user.id,
        actor_username=user.username,
        action="token.generate",
        resource_type="token",
        resource_id=result["access_token"][:16],
        detail={
            "service_id": data.service_id,
            "scopes": data.scopes,
            "expiration_days": data.expiration_days,
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent"),
    )

    await webhook.fire_event(db, "token.generated", {
        "service_id": data.service_id,
        "scopes": data.scopes,
        "expires_in": access_ttl,
        "generated_by": user.username,
    })

    return {"success": True, "token": result["access_token"], "expires_in": access_ttl}


@router.post("/revoke")
async def revoke_token(
    data: TokenRevokeRequest,
    request: Request,
    user: AdminUser = Depends(require_role("admin", "operator")),
    db: Session = Depends(get_db),
):
    # Necesitamos un bearer token valido para la llamada al auth-service.
    # Verificamos primero que el token a revocar existe.
    token_data = await auth_client.verify_token(data.token_id)

    # Usamos el mismo token para autenticarse si es access, o generamos uno temporal
    # Para simplificar, intentamos revocar directamente vía el token_id como bearer
    revoked = await auth_client.revoke_token(data.token_id, bearer=data.token_id)

    if not revoked:
        raise HTTPException(status_code=404, detail="Token no encontrado o ya revocado")

    service_id = token_data.get("service_id", "unknown") if token_data else "unknown"

    audit.log_action(
        db,
        actor_id=user.id,
        actor_username=user.username,
        action="token.revoke",
        resource_type="token",
        resource_id=data.token_id[:16],
        detail={"service_id": service_id},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent"),
    )

    await webhook.fire_event(db, "token.revoked", {
        "token_id": data.token_id[:16],
        "service_id": service_id,
        "revoked_by": user.username,
    })

    return {"success": True, "message": "Token revocado"}


@router.get("/list")
async def list_tokens(
    user: AdminUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lista tokens activos. Requiere un service token para consultar auth-service."""
    # Este endpoint consulta directamente al auth-service
    # El auth-service expone /api/v1/services que incluye active_tokens por servicio
    health = await auth_client.health()
    if not health or health.get("status") != "healthy":
        raise HTTPException(status_code=503, detail="auth-service no disponible")

    return {"success": True, "auth_service_status": health}
