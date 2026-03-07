import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, Text, JSON
from sqlalchemy.orm import sessionmaker
from sqlalchemy.dialects.postgresql import ARRAY, INET, JSONB

from app.core.database import Base, get_db
from app.core.security import hash_password
from app.models.db import AdminUser, AdminSession

# Adaptar tipos PostgreSQL para SQLite
# Reemplazar ARRAY(Text) -> JSON, JSONB -> JSON, INET -> Text
_pg_type_map = {JSONB: JSON, INET: Text}


@event.listens_for(Base.metadata, "column_reflect")
def _generalize_types(inspector, table, column_info):
    for pg_type, generic_type in _pg_type_map.items():
        if isinstance(column_info["type"], pg_type):
            column_info["type"] = generic_type()


# Parchear los tipos antes de crear tablas
for table in Base.metadata.tables.values():
    for column in table.columns:
        col_type = column.type
        if isinstance(col_type, ARRAY):
            column.type = JSON()
        elif isinstance(col_type, JSONB):
            column.type = JSON()
        elif isinstance(col_type, INET):
            column.type = Text()

# SQLite en memoria para tests
engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
TestSession = sessionmaker(bind=engine, autoflush=False)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


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
