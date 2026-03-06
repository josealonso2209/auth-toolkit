from fastapi import APIRouter, Depends, HTTPException, status

from app.core import token_manager
from app.core.config import settings
from app.core.redis_store import redis_store
from app.dependencies.auth import require_valid_token
from app.models.schemas import (
    ErrorResponse,
    RevokeAllResponse,
    SuccessResponse,
    TokenGenerateRequest,
    TokenIntrospectRequest,
    TokenIntrospectResponse,
    TokenPairResponse,
    TokenRefreshRequest,
    TokenVerifyRequest,
    TokenVerifyResponse,
)

router = APIRouter(prefix="/api/v1/tokens", tags=["tokens"])


@router.post("", response_model=TokenPairResponse, status_code=201)
async def generate_token(data: TokenGenerateRequest):
    # Verificar lockout
    if redis_store.is_locked(data.client_id):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Servicio bloqueado. Reintente en {settings.lockout_duration}s",
        )

    # Validar credenciales
    service = token_manager.validate_credentials(data.client_id, data.client_secret)
    if not service:
        attempts = redis_store.increment_failed_attempts(data.client_id)
        if attempts >= settings.max_failed_attempts:
            redis_store.lock_service(data.client_id)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales invalidas")

    redis_store.reset_failed_attempts(data.client_id)

    # Validar scopes solicitados contra scopes permitidos
    allowed = set(service.get("allowed_scopes", []))
    requested = set(data.scopes)
    if not requested.issubset(allowed):
        invalid = requested - allowed
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Scopes no permitidos: {', '.join(invalid)}",
        )

    tokens = token_manager.generate_token_pair(
        service_id=service["service_id"],
        service_name=service["service_name"],
        scopes=data.scopes,
        access_ttl=data.access_ttl,
        refresh_ttl=data.refresh_ttl,
        metadata=data.metadata,
    )
    return tokens


@router.post("/verify", response_model=TokenVerifyResponse)
async def verify_token(data: TokenVerifyRequest):
    # Rate limiting (si el servicio que consulta tiene limite)
    token_data = token_manager.verify_token(data.token)

    if not token_data:
        return TokenVerifyResponse(valid=False, token_data=None)

    return TokenVerifyResponse(valid=True, token_data=token_data)


@router.post("/refresh", response_model=TokenPairResponse, status_code=201)
async def refresh_token(data: TokenRefreshRequest):
    tokens = token_manager.refresh_access_token(data.refresh_token)
    if not tokens:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token invalido o expirado")
    return tokens


@router.delete(
    "/{token_id}",
    response_model=SuccessResponse,
    dependencies=[Depends(require_valid_token)],
)
async def revoke_token(token_id: str):
    if not token_manager.revoke_token(token_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Token no encontrado")
    return SuccessResponse(message="Token revocado")


@router.delete(
    "/revoke-all/{service_id}",
    response_model=RevokeAllResponse,
    dependencies=[Depends(require_valid_token)],
)
async def revoke_all_tokens(service_id: str):
    count = token_manager.revoke_all_tokens(service_id)
    return RevokeAllResponse(message=f"{count} tokens revocados", service_id=service_id, revoked_count=count)


@router.post("/introspect", response_model=TokenIntrospectResponse)
async def introspect_token(data: TokenIntrospectRequest):
    return token_manager.introspect_token(data.token)
