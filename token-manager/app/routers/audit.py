from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import require_role
from app.models.db import AdminUser
from app.models.schemas import AuditLogResponse
from app.services import audit

router = APIRouter(prefix="/api/audit", tags=["audit"])

# Acciones consideradas criticas para el monitor de incidentes
CRITICAL_ACTIONS = [
    "token.revoke_all",
    "service.delete",
    "service.lock",
]


def _parse_actions(actions_csv: str | None) -> list[str] | None:
    if not actions_csv:
        return None
    return [a.strip() for a in actions_csv.split(",") if a.strip()]


@router.get("", response_model=list[AuditLogResponse])
async def list_audit_logs(
    action: str | None = Query(None, description="Filtrar por accion"),
    actions: str | None = Query(None, description="Filtrar por varias acciones (CSV)"),
    critical: bool = Query(False, description="Solo eventos criticos"),
    resource_type: str | None = Query(None, description="Filtrar por tipo de recurso"),
    resource_id: str | None = Query(None, description="Filtrar por ID de recurso"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: AdminUser = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    actions_list = _parse_actions(actions)
    if critical:
        actions_list = CRITICAL_ACTIONS
    return audit.get_logs(
        db,
        action=action,
        actions=actions_list,
        resource_type=resource_type,
        resource_id=resource_id,
        limit=limit,
        offset=offset,
    )


@router.get("/count")
async def count_audit_logs(
    action: str | None = Query(None),
    actions: str | None = Query(None),
    critical: bool = Query(False),
    resource_type: str | None = Query(None),
    resource_id: str | None = Query(None),
    user: AdminUser = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    actions_list = _parse_actions(actions)
    if critical:
        actions_list = CRITICAL_ACTIONS
    total = audit.count_logs(
        db,
        action=action,
        actions=actions_list,
        resource_type=resource_type,
        resource_id=resource_id,
    )
    return {"total": total}
