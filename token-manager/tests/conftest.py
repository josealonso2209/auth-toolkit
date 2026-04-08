import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.database import Base, get_db
from app.core.security import hash_password
from app.models.db import AdminUser, AdminSession

# Engine de test usando la misma DATABASE_URL (PostgreSQL en CI)
test_engine = create_engine(settings.database_url, pool_pre_ping=True)
TestSession = sessionmaker(bind=test_engine, autoflush=False)

# Reemplazar engine en el modulo para que on_startup use el de test
import app.core.database as db_mod
db_mod.engine = test_engine
db_mod.SessionLocal = TestSession


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture()
def db():
    session = TestSession()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture()
def admin_user(db):
    # Limpiar admin que on_startup pudo haber creado
    db.query(AdminUser).filter(AdminUser.username == "admin").delete()
    db.commit()

    user = AdminUser(
        username="admin",
        email="admin@test.local",
        password_hash=hash_password("admin123"),
        role="admin",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture()
def admin_session(db, admin_user):
    session = AdminSession(
        id="test-session-id",
        user_id=admin_user.id,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
    )
    db.add(session)
    db.commit()
    return session


@pytest.fixture()
def mock_auth_client():
    with patch("app.routers.tokens.auth_client") as mock_tokens, \
         patch("app.routers.services.auth_client") as mock_services:
        for mock in (mock_tokens, mock_services):
            mock.register_service = AsyncMock(return_value=True)
            mock.generate_token = AsyncMock(return_value={
                "access_token": "fake-access-token-abc123",
                "refresh_token": "fake-refresh-token-xyz789",
                "token_type": "Bearer",
                "expires_in": 86400,
                "scopes": ["read"],
                "service_id": "test-svc",
            })
            mock.verify_token = AsyncMock(return_value={"service_id": "test-svc"})
            mock.verify_token_full = AsyncMock(return_value={
                "valid": True,
                "token_data": {
                    "service_id": "test-svc",
                    "service_name": "Test Service",
                    "scopes": ["read"],
                    "expires_at": "2099-01-01T00:00:00Z",
                },
            })
            mock.revoke_token = AsyncMock(return_value=True)
            mock.revoke_all_tokens = AsyncMock(return_value=3)
            mock.list_active_tokens = AsyncMock(return_value=[])
            mock.list_services = AsyncMock(return_value=[])
            mock.delete_service = AsyncMock(return_value=True)
            mock.lock_service = AsyncMock(return_value=True)
            mock.unlock_service = AsyncMock(return_value=True)
            mock.health = AsyncMock(return_value={"status": "healthy"})
        yield mock_tokens


@pytest.fixture()
def client(db, mock_auth_client):
    from app.main import app

    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()
