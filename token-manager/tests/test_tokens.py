from unittest.mock import AsyncMock, patch


def test_generate_token(client, admin_user, admin_session, mock_auth_client):
    resp = client.post(
        "/api/tokens/generate",
        json={
            "service_id": "test-svc",
            "service_name": "Test Service",
            "client_id": "test-client",
            "client_secret": "test-secret",
            "scopes": ["read"],
            "expiration_days": 30,
        },
        headers={"X-Session-Id": admin_session.id},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "token" in data

    mock_auth_client.register_service.assert_called_once()
    mock_auth_client.generate_token.assert_called_once()


def test_generate_token_unauthorized(client):
    resp = client.post("/api/tokens/generate", json={
        "service_id": "x",
        "service_name": "x",
        "client_id": "x",
        "client_secret": "x",
    })
    assert resp.status_code == 401


def test_generate_token_viewer_forbidden(client, db, admin_session):
    from app.models.db import AdminUser
    user = db.query(AdminUser).first()
    user.role = "viewer"
    db.commit()

    resp = client.post(
        "/api/tokens/generate",
        json={
            "service_id": "x",
            "service_name": "x",
            "client_id": "x",
            "client_secret": "x",
        },
        headers={"X-Session-Id": admin_session.id},
    )
    assert resp.status_code == 403


def test_revoke_token(client, admin_user, admin_session, mock_auth_client):
    resp = client.post(
        "/api/tokens/revoke",
        json={"token_id": "fake-token-id-to-revoke"},
        headers={"X-Session-Id": admin_session.id},
    )
    assert resp.status_code == 200
    assert resp.json()["success"] is True


def test_list_tokens(client, admin_user, admin_session, mock_auth_client):
    resp = client.get(
        "/api/tokens/list",
        headers={"X-Session-Id": admin_session.id},
    )
    assert resp.status_code == 200
    assert resp.json()["success"] is True


def test_test_token_valid(client, admin_user, admin_session, mock_auth_client):
    resp = client.post(
        "/api/tokens/test",
        json={"token": "fake-token-to-test"},
        headers={"X-Session-Id": admin_session.id},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["valid"] is True
    assert "latency_ms" in body
    assert body["token_data"]["service_id"] == "test-svc"
    mock_auth_client.verify_token_full.assert_called_once()


def test_test_token_invalid(client, admin_user, admin_session, mock_auth_client):
    mock_auth_client.verify_token_full.return_value = {"valid": False, "token_data": None}
    resp = client.post(
        "/api/tokens/test",
        json={"token": "definitely-not-real"},
        headers={"X-Session-Id": admin_session.id},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["valid"] is False
    assert body["token_data"] is None


def test_test_token_empty(client, admin_user, admin_session, mock_auth_client):
    resp = client.post(
        "/api/tokens/test",
        json={"token": "   "},
        headers={"X-Session-Id": admin_session.id},
    )
    assert resp.status_code == 400


def test_test_token_unauthorized(client):
    resp = client.post("/api/tokens/test", json={"token": "x"})
    assert resp.status_code == 401
