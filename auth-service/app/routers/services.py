from fastapi import APIRouter, Depends, HTTPException, status

from app.core import token_manager
from app.dependencies.auth import require_valid_token
from app.models.schemas import (
    ServiceDetailResponse,
    ServiceListResponse,
    ServiceRegisterRequest,
    ServiceRegisterResponse,
    SuccessResponse,
)

router = APIRouter(prefix="/api/v1/services", tags=["services"])


@router.post("", response_model=ServiceRegisterResponse, status_code=201)
async def register_service(data: ServiceRegisterRequest):
    success = token_manager.register_service(
        service_id=data.service_id,
        service_name=data.service_name,
        client_id=data.client_id,
        client_secret=data.client_secret,
        description=data.description,
        allowed_scopes=data.allowed_scopes,
        rate_limit=data.rate_limit,
    )
    if not success:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Servicio ya registrado")
    return ServiceRegisterResponse(message="Servicio registrado", service_id=data.service_id)


@router.get("", response_model=ServiceListResponse)
async def list_services():
    services = token_manager.list_services()
    return ServiceListResponse(services=services, total=len(services))


@router.get("/{service_id}", response_model=ServiceDetailResponse)
async def get_service(service_id: str):
    svc = token_manager.get_service_by_id(service_id)
    if not svc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Servicio no encontrado")
    svc.pop("client_secret_hash", None)
    svc["active_tokens"] = len(token_manager.redis_store.get_service_token_ids(service_id))
    return svc


@router.delete("/{service_id}", response_model=SuccessResponse)
async def delete_service(service_id: str):
    if not token_manager.delete_service(service_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Servicio no encontrado")
    return SuccessResponse(message="Servicio y todos sus tokens eliminados")
