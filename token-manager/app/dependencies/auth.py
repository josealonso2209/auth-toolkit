"""Dependencia de autenticacion basada en sesiones para el panel admin."""

from datetime import datetime, timezone

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.db import AdminSession, AdminUser


def get_current_user(request: Request, db: Session = Depends(get_db)) -> AdminUser:
    session_id = request.headers.get("X-Session-Id") or request.cookies.get("session_id")
    if not session_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sesion requerida")

    session = db.query(AdminSession).filter(
        AdminSession.id == session_id,
        AdminSession.is_active == True,
        AdminSession.expires_at > datetime.now(timezone.utc),
    ).first()

    if not session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sesion invalida o expirada")

    user = db.query(AdminUser).filter(AdminUser.id == session.user_id, AdminUser.is_active == True).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no encontrado")

    return user


def require_role(*roles: str):
    """Genera una dependencia que exige uno de los roles especificados."""
    def checker(user: AdminUser = Depends(get_current_user)) -> AdminUser:
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permisos insuficientes")
        return user
    return checker
