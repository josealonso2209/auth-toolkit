import hashlib
import json
import logging
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from cachetools import TTLCache

from app.core.config import settings
from app.core.redis_store import redis_store

logger = logging.getLogger("auth-service.tokens")

# Cache local para validaciones frecuentes
_verify_cache: TTLCache = TTLCache(
    maxsize=settings.local_cache_maxsize,
    ttl=settings.local_cache_ttl,
)


def _generate_token_id() -> str:
    """Genera un ID de token criptograficamente seguro."""
    random_bytes = secrets.token_bytes(16)
    unique = str(uuid.uuid4())
    combined = f"{unique}-{random_bytes.hex()}"
    return hashlib.sha256(combined.encode()).hexdigest()


def _hash_secret(secret: str) -> str:
    return hashlib.sha256(secret.encode()).hexdigest()


# ---------------------------------------------------------------------------
# Servicios
# ---------------------------------------------------------------------------


def register_service(
    service_id: str,
    service_name: str,
    client_id: str,
    client_secret: str,
    description: str = "",
    allowed_scopes: list[str] | None = None,
    rate_limit: int = 0,
) -> bool:
    existing = redis_store.get_service(client_id)
    if existing:
        return False

    data = {
        "service_id": service_id,
        "service_name": service_name,
        "client_id": client_id,
        "client_secret_hash": _hash_secret(client_secret),
        "description": description,
        "allowed_scopes": allowed_scopes or ["read", "write"],
        "rate_limit": rate_limit,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    redis_store.set_service(client_id, data)
    logger.info("Service registered: %s (%s)", service_id, client_id)
    return True


def validate_credentials(client_id: str, client_secret: str) -> Optional[dict]:
    service = redis_store.get_service(client_id)
    if not service:
        return None
    if not service.get("is_active"):
        return None
    if service.get("client_secret_hash") != _hash_secret(client_secret):
        return None
    return service


def get_service(client_id: str) -> Optional[dict]:
    return redis_store.get_service(client_id)


def get_service_by_id(service_id: str) -> Optional[dict]:
    for svc in redis_store.get_all_services():
        if svc.get("service_id") == service_id:
            return svc
    return None


def list_services() -> list[dict]:
    services = redis_store.get_all_services()
    for svc in services:
        svc.pop("client_secret_hash", None)
        token_ids = redis_store.get_service_token_ids(svc["service_id"])
        svc["active_tokens"] = len(token_ids)
    return services


def delete_service(service_id: str) -> bool:
    svc = get_service_by_id(service_id)
    if not svc:
        return False
    revoke_all_tokens(service_id)
    redis_store.delete_service(svc["client_id"])
    logger.info("Service deleted: %s", service_id)
    return True


# ---------------------------------------------------------------------------
# Tokens
# ---------------------------------------------------------------------------


def generate_token_pair(
    service_id: str,
    service_name: str,
    scopes: list[str] | None = None,
    access_ttl: int | None = None,
    refresh_ttl: int | None = None,
    metadata: dict | None = None,
) -> dict:
    access_ttl = access_ttl or settings.default_access_ttl
    refresh_ttl = refresh_ttl or settings.default_refresh_ttl

    access_id = _generate_token_id()
    refresh_id = _generate_token_id()
    now = datetime.now(timezone.utc)

    access_data = {
        "token_type": "access",
        "service_id": service_id,
        "service_name": service_name,
        "scopes": scopes or ["read"],
        "created_at": now.isoformat(),
        "expires_at": (now + timedelta(seconds=access_ttl)).isoformat(),
        "metadata": metadata or {},
    }

    refresh_data = {
        "token_type": "refresh",
        "service_id": service_id,
        "service_name": service_name,
        "access_token_id": access_id,
        "created_at": now.isoformat(),
        "expires_at": (now + timedelta(seconds=refresh_ttl)).isoformat(),
    }

    redis_store.set_token(access_id, access_data, access_ttl)
    redis_store.set_token(refresh_id, refresh_data, refresh_ttl)
    redis_store.add_to_service_index(service_id, access_id, access_ttl)
    redis_store.add_to_service_index(service_id, refresh_id, refresh_ttl)

    logger.info("Token pair generated for %s", service_id)

    return {
        "access_token": access_id,
        "refresh_token": refresh_id,
        "token_type": "Bearer",
        "expires_in": access_ttl,
        "scopes": scopes or ["read"],
        "service_id": service_id,
    }


def verify_token(token_id: str) -> Optional[dict]:
    """Valida un access token. Usa cache local para rendimiento."""
    # Cache local hit
    cached = _verify_cache.get(token_id)
    if cached is not None:
        return cached

    token_data = redis_store.get_token(token_id)
    if not token_data:
        return None

    if token_data.get("token_type") != "access":
        return None

    # Guardar en cache local
    _verify_cache[token_id] = token_data
    return token_data


def refresh_access_token(refresh_token_id: str) -> Optional[dict]:
    """Rota tokens: invalida refresh viejo y genera par nuevo."""
    refresh_data = redis_store.get_token(refresh_token_id)
    if not refresh_data:
        return None

    if refresh_data.get("token_type") != "refresh":
        return None

    service_id = refresh_data["service_id"]
    service_name = refresh_data["service_name"]

    # Invalidar refresh token usado (rotacion)
    redis_store.delete_token(refresh_token_id)
    redis_store.remove_from_service_index(service_id, refresh_token_id)

    # Invalidar access token viejo asociado
    old_access_id = refresh_data.get("access_token_id")
    if old_access_id:
        redis_store.delete_token(old_access_id)
        redis_store.remove_from_service_index(service_id, old_access_id)
        _verify_cache.pop(old_access_id, None)

    return generate_token_pair(service_id=service_id, service_name=service_name)


def revoke_token(token_id: str) -> bool:
    token_data = redis_store.get_token(token_id)
    if not token_data:
        return False

    service_id = token_data.get("service_id")
    redis_store.delete_token(token_id)
    if service_id:
        redis_store.remove_from_service_index(service_id, token_id)

    _verify_cache.pop(token_id, None)

    logger.info("Token revoked: %s", token_id[:16])
    return True


def revoke_all_tokens(service_id: str) -> int:
    token_ids = redis_store.get_service_token_ids(service_id)
    count = 0
    for tid in token_ids:
        if redis_store.delete_token(tid):
            _verify_cache.pop(tid, None)
            count += 1

    redis_store.delete_service_index(service_id)
    logger.info("Revoked %d tokens for %s", count, service_id)
    return count


def introspect_token(token_id: str) -> dict:
    """RFC 7662 Token Introspection."""
    token_data = redis_store.get_token(token_id)
    if not token_data or token_data.get("token_type") != "access":
        return {"active": False}

    return {
        "active": True,
        "scope": " ".join(token_data.get("scopes", [])),
        "client_id": token_data.get("service_id"),
        "token_type": "Bearer",
        "exp": int(datetime.fromisoformat(token_data["expires_at"]).timestamp()),
        "iat": int(datetime.fromisoformat(token_data["created_at"]).timestamp()),
    }
