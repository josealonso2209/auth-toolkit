def test_login_success(client, admin_user):
    resp = client.post("/api/auth/login", json={
        "username": "admin",
        "password": "admin123",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["message"] == "Login exitoso"
    assert "session_id" in data
    assert data["user"]["username"] == "admin"
    assert data["user"]["role"] == "admin"


def test_login_wrong_password(client, admin_user):
    resp = client.post("/api/auth/login", json={
        "username": "admin",
        "password": "wrong",
    })
    assert resp.status_code == 401


def test_login_nonexistent_user(client):
    resp = client.post("/api/auth/login", json={
        "username": "ghost",
        "password": "anything",
    })
    assert resp.status_code == 401


def test_logout(client, admin_user, admin_session):
    resp = client.post(
        "/api/auth/logout",
        headers={"X-Session-Id": admin_session.id},
    )
    assert resp.status_code == 200
    assert resp.json()["message"] == "Sesion cerrada"


def test_security_headers(client):
    resp = client.post("/api/auth/login", json={"username": "x", "password": "x"})
    assert resp.headers["X-Content-Type-Options"] == "nosniff"
    assert resp.headers["X-Frame-Options"] == "SAMEORIGIN"
