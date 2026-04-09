"""Tests para endpoints de partner (self-service API keys)."""

from app.models.db import ServiceOwnership


PARTNER_HEADERS = {"X-Session-Id": "test-partner-session"}
ADMIN_HEADERS = {"X-Session-Id": "test-session-id"}


class TestPartnerCreateKey:
    def test_create_key_success(self, client, admin_user, admin_session, partner_user, partner_session, db):
        resp = client.post(
            "/api/partner/keys",
            json={"service_name": "Mi Integracion", "scopes": ["read"], "rate_limit": 10},
            headers=PARTNER_HEADERS,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["service_name"] == "Mi Integracion"
        assert data["client_id"].endswith("-client")
        assert "client_secret" in data
        assert data["scopes"] == ["read"]
        assert data["rate_limit"] == 10
        # Ownership created
        own = db.query(ServiceOwnership).filter(ServiceOwnership.owner_id == partner_user.id).first()
        assert own is not None
        assert own.service_id == data["service_id"]

    def test_quota_exceeded(self, client, admin_user, admin_session, partner_user, partner_session, db):
        # Fill quota (max_services=3)
        for i in range(3):
            db.add(ServiceOwnership(service_id=f"partner-{partner_user.id}-fake{i}", owner_id=partner_user.id))
        db.commit()

        resp = client.post(
            "/api/partner/keys",
            json={"service_name": "Exceso", "scopes": ["read"]},
            headers=PARTNER_HEADERS,
        )
        assert resp.status_code == 403
        assert "Cuota" in resp.json()["detail"]

    def test_invalid_scope(self, client, admin_user, admin_session, partner_user, partner_session):
        resp = client.post(
            "/api/partner/keys",
            json={"service_name": "Bad Scope", "scopes": ["admin"]},
            headers=PARTNER_HEADERS,
        )
        assert resp.status_code == 400
        assert "Scopes no permitidos" in resp.json()["detail"]

    def test_rate_limit_exceeded(self, client, admin_user, admin_session, partner_user, partner_session):
        resp = client.post(
            "/api/partner/keys",
            json={"service_name": "High Rate", "scopes": ["read"], "rate_limit": 999},
            headers=PARTNER_HEADERS,
        )
        assert resp.status_code == 400
        assert "Rate limit" in resp.json()["detail"]


class TestPartnerListKeys:
    def test_list_own_keys(self, client, admin_user, admin_session, partner_user, partner_session, db, mock_auth_client):
        # Create ownership record
        db.add(ServiceOwnership(service_id=f"partner-{partner_user.id}-abc1", owner_id=partner_user.id))
        db.commit()

        # Mock list_services to return the owned service
        from unittest.mock import AsyncMock
        import app.routers.partner as partner_mod
        partner_mod.auth_client.list_services = AsyncMock(return_value=[
            {
                "service_id": f"partner-{partner_user.id}-abc1",
                "service_name": "My Key",
                "client_id": f"partner-{partner_user.id}-abc1-client",
                "allowed_scopes": ["read"],
                "rate_limit": 10,
                "is_active": True,
                "created_at": "2025-01-01T00:00:00Z",
            },
            {
                "service_id": "partner-999-other",
                "service_name": "Other Partner Key",
                "client_id": "partner-999-other-client",
                "allowed_scopes": ["read"],
                "rate_limit": 5,
                "is_active": True,
                "created_at": "2025-01-01T00:00:00Z",
            },
        ])

        resp = client.get("/api/partner/keys", headers=PARTNER_HEADERS)
        assert resp.status_code == 200
        keys = resp.json()
        assert len(keys) == 1
        assert keys[0]["service_id"] == f"partner-{partner_user.id}-abc1"


class TestPartnerDeleteKey:
    def test_delete_own_key(self, client, admin_user, admin_session, partner_user, partner_session, db):
        sid = f"partner-{partner_user.id}-del1"
        db.add(ServiceOwnership(service_id=sid, owner_id=partner_user.id))
        db.commit()

        resp = client.delete(f"/api/partner/keys/{sid}", headers=PARTNER_HEADERS)
        assert resp.status_code == 200
        assert resp.json()["success"] is True
        assert db.query(ServiceOwnership).filter(ServiceOwnership.service_id == sid).first() is None

    def test_cannot_delete_other_key(self, client, admin_user, admin_session, partner_user, partner_session, db):
        # Ownership belongs to admin_user, not partner_user
        db.add(ServiceOwnership(service_id="partner-other-key", owner_id=admin_user.id))
        db.commit()

        resp = client.delete("/api/partner/keys/partner-other-key", headers=PARTNER_HEADERS)
        assert resp.status_code == 404


class TestPartnerQuota:
    def test_get_quota(self, client, admin_user, admin_session, partner_user, partner_session, db):
        db.add(ServiceOwnership(service_id=f"partner-{partner_user.id}-q1", owner_id=partner_user.id))
        db.commit()

        resp = client.get("/api/partner/quota", headers=PARTNER_HEADERS)
        assert resp.status_code == 200
        data = resp.json()
        assert data["quota"]["max_services"] == 3
        assert data["usage"]["services_used"] == 1


class TestPartnerAccess:
    def test_admin_cannot_access_partner_keys(self, client, admin_user, admin_session):
        resp = client.get("/api/partner/keys", headers=ADMIN_HEADERS)
        assert resp.status_code == 403

    def test_unauthenticated_cannot_access(self, client):
        resp = client.get("/api/partner/keys")
        assert resp.status_code == 401


class TestAdminPartnerQuotaUpdate:
    def test_admin_update_quota(self, client, admin_user, admin_session, partner_user, partner_session, db):
        resp = client.put(
            f"/api/users/{partner_user.id}/quota",
            json={"max_services": 10, "max_rate_limit": 200},
            headers=ADMIN_HEADERS,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["quota"]["max_services"] == 10
        assert data["quota"]["max_rate_limit"] == 200

    def test_cannot_update_non_partner(self, client, admin_user, admin_session):
        resp = client.put(
            f"/api/users/{admin_user.id}/quota",
            json={"max_services": 10},
            headers=ADMIN_HEADERS,
        )
        assert resp.status_code == 400
        assert "partner" in resp.json()["detail"].lower()


class TestCreatePartnerUser:
    def test_create_partner_with_quota(self, client, admin_user, admin_session):
        resp = client.post(
            "/api/users",
            json={
                "username": "newpartner",
                "email": "new@partner.com",
                "password": "secret123",
                "role": "partner",
                "partner_quota": {"max_services": 10, "max_rate_limit": 200, "allowed_scopes": ["read"]},
            },
            headers=ADMIN_HEADERS,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["role"] == "partner"
        assert data["partner_quota"]["max_services"] == 10

    def test_create_partner_default_quota(self, client, admin_user, admin_session):
        resp = client.post(
            "/api/users",
            json={
                "username": "defpartner",
                "email": "def@partner.com",
                "password": "secret123",
                "role": "partner",
            },
            headers=ADMIN_HEADERS,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["role"] == "partner"
        assert data["partner_quota"]["max_services"] == 5
