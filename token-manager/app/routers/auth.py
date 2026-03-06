from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import generate_session_id, verify_password
from app.dependencies.auth import get_current_user
from app.models.db import AdminSession, AdminUser
from app.models.schemas import LoginRequest, LoginResponse, MessageResponse, UserResponse
from app.services import audit

router = APIRouter(prefix="/api/auth", tags=["auth"])

SESSION_TTL_HOURS = 24


@router.post("/login", response_model=LoginResponse)
async def login(data: LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = db.query(AdminUser).filter(AdminUser.username == data.username, AdminUser.is_active == True).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales invalidas")

    session_id = generate_session_id()
    session = AdminSession(
        id=session_id,
        user_id=user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent"),
        expires_at=datetime.now(timezone.utc) + timedelta(hours=SESSION_TTL_HOURS),
    )
    db.add(session)
    db.commit()

    audit.log_action(
        db,
        actor_id=user.id,
        actor_username=user.username,
        action="user.login",
        resource_type="user",
        resource_id=str(user.id),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent"),
    )

    return LoginResponse(
        message="Login exitoso",
        session_id=session_id,
        user=UserResponse.model_validate(user),
    )


@router.post("/logout", response_model=MessageResponse)
async def logout(request: Request, user: AdminUser = Depends(get_current_user), db: Session = Depends(get_db)):
    session_id = request.headers.get("X-Session-Id") or request.cookies.get("session_id")
    if session_id:
        session = db.query(AdminSession).filter(AdminSession.id == session_id).first()
        if session:
            session.is_active = False
            db.commit()

    audit.log_action(
        db,
        actor_id=user.id,
        actor_username=user.username,
        action="user.logout",
        resource_type="user",
        resource_id=str(user.id),
        ip_address=request.client.host if request.client else None,
    )

    return MessageResponse(message="Sesion cerrada")
