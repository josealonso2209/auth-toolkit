from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

from app.models.db import Webhook, WebhookDelivery


def _create_webhook(db, name="test-wh"):
    wh = Webhook(
        name=name,
        url="https://example.com/hook",
        events=["token.generated"],
    )
    db.add(wh)
    db.commit()
    db.refresh(wh)
    return wh


def _create_delivery(db, webhook_id, success=False, status=500):
    delivery = WebhookDelivery(
        webhook_id=webhook_id,
        event="token.generated",
        payload={"service_id": "svc-1"},
        response_status=status,
        success=success,
        attempt=1,
        delivered_at=datetime.now(timezone.utc),
        duration_ms=120,
    )
    db.add(delivery)
    db.commit()
    db.refresh(delivery)
    return delivery


def test_retry_delivery_success(client, admin_user, admin_session, db):
    wh = _create_webhook(db)
    delivery = _create_delivery(db, wh.id)

    new_delivery_obj = WebhookDelivery(
        id=99999,
        webhook_id=wh.id,
        event="token.generated",
        payload={"service_id": "svc-1"},
        response_status=200,
        success=True,
        attempt=1,
        delivered_at=datetime.now(timezone.utc),
        duration_ms=80,
    )
    with patch("app.routers.webhooks.webhook_service.retry_delivery", new=AsyncMock(return_value=new_delivery_obj)):
        resp = client.post(
            f"/api/webhooks/{wh.id}/deliveries/{delivery.id}/retry",
            headers={"X-Session-Id": admin_session.id},
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["response_status"] == 200


def test_retry_delivery_webhook_not_found(client, admin_user, admin_session):
    resp = client.post(
        "/api/webhooks/9999/deliveries/1/retry",
        headers={"X-Session-Id": admin_session.id},
    )
    assert resp.status_code == 404


def test_retry_delivery_not_found(client, admin_user, admin_session, db):
    wh = _create_webhook(db)
    resp = client.post(
        f"/api/webhooks/{wh.id}/deliveries/9999/retry",
        headers={"X-Session-Id": admin_session.id},
    )
    assert resp.status_code == 404


def test_retry_delivery_requires_admin(client, db, admin_session):
    from app.models.db import AdminUser
    user = db.query(AdminUser).first()
    user.role = "operator"
    db.commit()

    wh = _create_webhook(db)
    delivery = _create_delivery(db, wh.id)
    resp = client.post(
        f"/api/webhooks/{wh.id}/deliveries/{delivery.id}/retry",
        headers={"X-Session-Id": admin_session.id},
    )
    assert resp.status_code == 403


def test_retry_delivery_unauthorized(client):
    resp = client.post("/api/webhooks/1/deliveries/1/retry")
    assert resp.status_code == 401
