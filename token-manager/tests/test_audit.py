from app.services.audit import log_action, get_logs, count_logs


def test_log_action(db):
    entry = log_action(
        db,
        actor_id=1,
        actor_username="admin",
        action="token.generate",
        resource_type="token",
        resource_id="abc123",
        detail={"service_id": "test-svc"},
    )
    assert entry.id is not None
    assert entry.action == "token.generate"
    assert entry.detail == {"service_id": "test-svc"}


def test_get_logs_filtered(db):
    log_action(db, actor_id=1, actor_username="admin", action="token.generate",
               resource_type="token")
    log_action(db, actor_id=1, actor_username="admin", action="token.revoke",
               resource_type="token")
    log_action(db, actor_id=1, actor_username="admin", action="user.login",
               resource_type="user")

    token_logs = get_logs(db, resource_type="token")
    assert len(token_logs) == 2

    revoke_logs = get_logs(db, action="token.revoke")
    assert len(revoke_logs) == 1


def test_count_logs(db):
    for _ in range(5):
        log_action(db, actor_id=1, actor_username="admin", action="token.generate",
                   resource_type="token")

    assert count_logs(db) == 5
    assert count_logs(db, action="token.generate") == 5
    assert count_logs(db, action="token.revoke") == 0
