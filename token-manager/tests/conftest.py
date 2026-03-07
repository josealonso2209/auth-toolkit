import os

# Forzar SQLite ANTES de cualquier import de la app
os.environ["DATABASE_URL"] = "sqlite:///:memory:"

import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

from sqlalchemy import create_engine, JSON, Text, Integer, BigInteger
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy.dialects.postgresql import ARRAY, INET, JSONB

from app.core.database import Base

# Adaptar tipos PostgreSQL → SQLite
for table in Base.metadata.tables.values():
    for col in table.columns:
        if isinstance(col.type, (ARRAY, JSONB)):
            col.type = JSON()
        elif isinstance(col.type, INET):
            col.type = Text()
        if isinstance(col.type, BigInteger) and col.primary_key:
            col.type = Integer()

# Engine unico en memoria (StaticPool = misma conexion para todos)
test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSession = sessionmaker(bind=test_engine, autoflush=False)

# Reemplazar engine y SessionLocal ANTES de importar app.main
import app.core.database as db_mod
db_mod.engine = test_engine
db_mod.SessionLocal = TestSession

from app.core.database import get_db
from app.core.security import hash_password
from app.models.db import AdminUser, AdminSession


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture()
def db():
    session = TestSession()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def admin_user(db):
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
    with patch("app.routers.tokens.auth_client") as mock:
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
        mock.revoke_token = AsyncMock(return_value=True)
        mock.health = AsyncMock(return_value={"status": "healthy"})
        yield mock


@pytest.fixture()
def client(db, mock_auth_client):
    from app.main import app

    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()
