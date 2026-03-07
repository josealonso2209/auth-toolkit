import pytest

SERVICE = {
    "service_id": "tok-svc",
    "service_name": "Token Test Service",
    "client_id": "tok-client",
    "client_secret": "tok-secret",
    "allowed_scopes": ["read", "write"],
}

TOKEN_REQUEST = {
    "client_id": "tok-client",
    "client_secret": "tok-secret",
    "scopes": ["read"],
}


@pytest.fixture()
def registered_client(client):
    client.post("/api/v1/services", json=SERVICE)
    return client


def test_generate_token(registered_client):
    resp = registered_client.post("/api/v1/tokens", json=TOKEN_REQUEST)
    assert resp.status_code == 201
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "Bearer"
    assert data["scopes"] == ["read"]


def test_generate_token_invalid_credentials(registered_client):
    resp = registered_client.post("/api/v1/tokens", json={
        "client_id": "tok-client",
        "client_secret": "wrong-secret",
    })
    assert resp.status_code == 401


def test_generate_token_invalid_scopes(registered_client):
    resp = registered_client.post("/api/v1/tokens", json={
        "client_id": "tok-client",
        "client_secret": "tok-secret",
        "scopes": ["admin"],
    })
    assert resp.status_code == 403


def test_verify_token(registered_client):
    gen = registered_client.post("/api/v1/tokens", json=TOKEN_REQUEST)
    token = gen.json()["access_token"]

    resp = registered_client.post("/api/v1/tokens/verify", json={"token": token})
    assert resp.status_code == 200
    data = resp.json()
    assert data["valid"] is True
    assert data["token_data"]["service_id"] == "tok-svc"


def test_verify_invalid_token(registered_client):
    resp = registered_client.post("/api/v1/tokens/verify", json={"token": "nonexistent"})
    assert resp.status_code == 200
    assert resp.json()["valid"] is False


def test_refresh_token(registered_client):
    gen = registered_client.post("/api/v1/tokens", json=TOKEN_REQUEST)
    refresh = gen.json()["refresh_token"]

    resp = registered_client.post("/api/v1/tokens/refresh", json={"refresh_token": refresh})
    assert resp.status_code == 201
    data = resp.json()
    assert "access_token" in data
    # El refresh viejo ya no debe funcionar
    resp2 = registered_client.post("/api/v1/tokens/refresh", json={"refresh_token": refresh})
    assert resp2.status_code == 401


def test_revoke_token(registered_client):
    gen = registered_client.post("/api/v1/tokens", json=TOKEN_REQUEST)
    access = gen.json()["access_token"]

    resp = registered_client.delete(
        f"/api/v1/tokens/{access}",
        headers={"Authorization": f"Bearer {access}"},
    )
    assert resp.status_code == 200

    # Ya no debe ser valido
    verify = registered_client.post("/api/v1/tokens/verify", json={"token": access})
    assert verify.json()["valid"] is False


def test_introspect_token(registered_client):
    gen = registered_client.post("/api/v1/tokens", json=TOKEN_REQUEST)
    token = gen.json()["access_token"]

    resp = registered_client.post("/api/v1/tokens/introspect", json={"token": token})
    assert resp.status_code == 200
    data = resp.json()
    assert data["active"] is True
    assert data["client_id"] == "tok-svc"


def test_lockout_after_failed_attempts(registered_client):
    for _ in range(5):
        registered_client.post("/api/v1/tokens", json={
            "client_id": "tok-client",
            "client_secret": "wrong",
        })

    resp = registered_client.post("/api/v1/tokens", json=TOKEN_REQUEST)
    assert resp.status_code == 429
