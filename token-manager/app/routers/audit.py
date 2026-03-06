from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import require_role
from app.models.db import AdminUser
from app.models.schemas import AuditLogResponse
from app.services import audit

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("", response_model=list[AuditLogResponse])
async def list_audit_logs(
    action: str | None = Query(None, description="Filtrar por accion"),
    resource_type: str | None = Query(None, description="Filtrar por tipo de recurso"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: AdminUser = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    return audit.get_logs(db, action=action, resource_type=resource_type, limit=limit, offset=offset)


@router.get("/count")
async def count_audit_logs(
    action: str | None = Query(None),
    resource_type: str | None = Query(None),
    user: AdminUser = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    total = audit.count_logs(db, action=action, resource_type=resource_type)
    return {"total": total}
