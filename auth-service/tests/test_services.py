SERVICE_PAYLOAD = {
    "service_id": "test-svc",
    "service_name": "Test Service",
    "client_id": "test-client",
    "client_secret": "test-secret",
    "allowed_scopes": ["read", "write"],
}


def test_register_service(client):
    resp = client.post("/api/v1/services", json=SERVICE_PAYLOAD)
    assert resp.status_code == 201
    assert resp.json()["service_id"] == "test-svc"


def test_register_duplicate_service(client):
    client.post("/api/v1/services", json=SERVICE_PAYLOAD)
    resp = client.post("/api/v1/services", json=SERVICE_PAYLOAD)
    assert resp.status_code == 409


def test_lock_unlock_service(client):
    client.post("/api/v1/services", json=SERVICE_PAYLOAD)

    resp = client.post("/api/v1/services/test-svc/lock")
    assert resp.status_code == 200
    assert "bloqueado" in resp.json()["message"]

    # Servicio bloqueado no puede generar tokens
    token_resp = client.post(
        "/api/v1/tokens",
        json={
            "client_id": "test-client",
            "client_secret": "test-secret",
            "scopes": ["read"],
        },
    )
    assert token_resp.status_code == 401

    resp = client.post("/api/v1/services/test-svc/unlock")
    assert resp.status_code == 200
    assert "desbloqueado" in resp.json()["message"]

    # Tras unlock, vuelve a poder generar tokens
    token_resp = client.post(
        "/api/v1/tokens",
        json={
            "client_id": "test-client",
            "client_secret": "test-secret",
            "scopes": ["read"],
        },
    )
    assert token_resp.status_code == 201


def test_lock_unknown_service(client):
    resp = client.post("/api/v1/services/no-existe/lock")
    assert resp.status_code == 404
