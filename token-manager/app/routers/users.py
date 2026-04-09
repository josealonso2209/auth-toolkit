from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import hash_password
from app.dependencies.auth import get_current_user, require_role
from app.models.db import AdminUser
from app.models.schemas import MessageResponse, PartnerQuota, PartnerQuotaUpdate, UserCreate, UserResponse, UserUpdate
from app.services import audit

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("", response_model=list[UserResponse])
async def list_users(
    user: AdminUser = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    return db.query(AdminUser).order_by(AdminUser.created_at.desc()).all()


@router.post("", response_model=UserResponse, status_code=201)
async def create_user(
    data: UserCreate,
    request: Request,
    user: AdminUser = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    if data.role not in ("admin", "operator", "viewer", "partner"):
        raise HTTPException(status_code=400, detail="Rol invalido")

    existing = db.query(AdminUser).filter(
        (AdminUser.username == data.username) | (AdminUser.email == data.email)
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Usuario o email ya existe")

    partner_quota = None
    if data.role == "partner":
        if data.partner_quota:
            partner_quota = data.partner_quota.model_dump()
        else:
            partner_quota = PartnerQuota().model_dump()

    new_user = AdminUser(
        username=data.username,
        email=data.email,
        password_hash=hash_password(data.password),
        role=data.role,
        partner_quota=partner_quota,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    audit.log_action(
        db,
        actor_id=user.id,
        actor_username=user.username,
        action="user.create",
        resource_type="user",
        resource_id=str(new_user.id),
        detail={"username": new_user.username, "role": new_user.role},
        ip_address=request.client.host if request.client else None,
    )

    return new_user


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    data: UserUpdate,
    request: Request,
    user: AdminUser = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    target = db.query(AdminUser).filter(AdminUser.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    changes = {}
    if data.email is not None:
        target.email = data.email
        changes["email"] = data.email
    if data.role is not None:
        if data.role not in ("admin", "operator", "viewer", "partner"):
            raise HTTPException(status_code=400, detail="Rol invalido")
        target.role = data.role
        changes["role"] = data.role
    if data.is_active is not None:
        target.is_active = data.is_active
        changes["is_active"] = data.is_active

    db.commit()
    db.refresh(target)

    audit.log_action(
        db,
        actor_id=user.id,
        actor_username=user.username,
        action="user.update",
        resource_type="user",
        resource_id=str(user_id),
        detail=changes,
        ip_address=request.client.host if request.client else None,
    )

    return target


@router.delete("/{user_id}", response_model=MessageResponse)
async def delete_user(
    user_id: int,
    request: Request,
    user: AdminUser = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    if user_id == user.id:
        raise HTTPException(status_code=400, detail="No puedes eliminarte a ti mismo")

    target = db.query(AdminUser).filter(AdminUser.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    username = target.username
    db.delete(target)
    db.commit()

    audit.log_action(
        db,
        actor_id=user.id,
        actor_username=user.username,
        action="user.delete",
        resource_type="user",
        resource_id=str(user_id),
        detail={"deleted_username": username},
        ip_address=request.client.host if request.client else None,
    )

    return MessageResponse(message=f"Usuario {username} eliminado")


@router.put("/{user_id}/quota")
async def update_partner_quota(
    user_id: int,
    data: PartnerQuotaUpdate,
    request: Request,
    user: AdminUser = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    target = db.query(AdminUser).filter(AdminUser.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if target.role != "partner":
        raise HTTPException(status_code=400, detail="Solo se pueden editar cuotas de partners")

    quota = dict(target.partner_quota or PartnerQuota().model_dump())
    changes = {}
    if data.max_services is not None:
        quota["max_services"] = data.max_services
        changes["max_services"] = data.max_services
    if data.max_rate_limit is not None:
        quota["max_rate_limit"] = data.max_rate_limit
        changes["max_rate_limit"] = data.max_rate_limit
    if data.allowed_scopes is not None:
        quota["allowed_scopes"] = data.allowed_scopes
        changes["allowed_scopes"] = data.allowed_scopes

    # Assign new dict to trigger SQLAlchemy JSONB change detection
    target.partner_quota = quota
    db.commit()
    db.refresh(target)

    audit.log_action(
        db,
        actor_id=user.id,
        actor_username=user.username,
        action="partner.quota.update",
        resource_type="user",
        resource_id=str(user_id),
        detail=changes,
        ip_address=request.client.host if request.client else None,
    )

    return {"success": True, "quota": target.partner_quota}
