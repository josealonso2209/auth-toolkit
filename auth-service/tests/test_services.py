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
