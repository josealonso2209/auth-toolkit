def test_lock_service(client, admin_user, admin_session, mock_auth_client):
    resp = client.post(
        "/api/services/test-svc/lock",
        headers={"X-Session-Id": admin_session.id},
    )
    assert resp.status_code == 200
    assert resp.json()["success"] is True
    assert "bloqueado" in resp.json()["message"]


def test_unlock_service(client, admin_user, admin_session, mock_auth_client):
    resp = client.post(
        "/api/services/test-svc/unlock",
        headers={"X-Session-Id": admin_session.id},
    )
    assert resp.status_code == 200
    assert resp.json()["success"] is True
    assert "desbloqueado" in resp.json()["message"]


def test_revoke_all_tokens_for_service(client, admin_user, admin_session, mock_auth_client):
    resp = client.post(
        "/api/services/test-svc/revoke-all",
        headers={"X-Session-Id": admin_session.id},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["revoked_count"] == 3


def test_lock_service_requires_admin(client, db, admin_session):
    from app.models.db import AdminUser
    user = db.query(AdminUser).first()
    user.role = "operator"
    db.commit()

    resp = client.post(
        "/api/services/test-svc/lock",
        headers={"X-Session-Id": admin_session.id},
    )
    assert resp.status_code == 403


def test_lock_service_unauthorized(client):
    resp = client.post("/api/services/test-svc/lock")
    assert resp.status_code == 401
