"""Servicio de auditoria inmutable."""

import logging

from sqlalchemy.orm import Session

from app.models.db import AuditLog

logger = logging.getLogger("token-manager.audit")


def log_action(
    db: Session,
    *,
    actor_id: int | None,
    actor_username: str,
    action: str,
    resource_type: str,
    resource_id: str | None = None,
    detail: dict | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> AuditLog:
    entry = AuditLog(
        actor_id=actor_id,
        actor_username=actor_username,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        detail=detail,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    logger.info("%s | %s | %s:%s", actor_username, action, resource_type, resource_id or "")
    return entry


def get_logs(
    db: Session,
    *,
    action: str | None = None,
    resource_type: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[AuditLog]:
    query = db.query(AuditLog)
    if action:
        query = query.filter(AuditLog.action == action)
    if resource_type:
        query = query.filter(AuditLog.resource_type == resource_type)
    return query.order_by(AuditLog.timestamp.desc()).offset(offset).limit(limit).all()


def count_logs(
    db: Session,
    *,
    action: str | None = None,
    resource_type: str | None = None,
) -> int:
    query = db.query(AuditLog)
    if action:
        query = query.filter(AuditLog.action == action)
    if resource_type:
        query = query.filter(AuditLog.resource_type == resource_type)
    return query.count()
