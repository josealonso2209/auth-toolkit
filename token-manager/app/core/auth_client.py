"""Cliente HTTP para comunicarse con el auth-service."""

import logging
from typing import Optional

import httpx

from app.core.config import settings

logger = logging.getLogger("token-manager.auth_client")

_TIMEOUT = 10.0


async def _post(path: str, json: dict | None = None, headers: dict | None = None) -> httpx.Response:
    async with httpx.AsyncClient(base_url=settings.auth_service_url, timeout=_TIMEOUT) as client:
        return await client.post(path, json=json, headers=headers)


async def _get(path: str, headers: dict | None = None) -> httpx.Response:
    async with httpx.AsyncClient(base_url=settings.auth_service_url, timeout=_TIMEOUT) as client:
        return await client.get(path, headers=headers)


async def _delete(path: str, headers: dict | None = None) -> httpx.Response:
    async with httpx.AsyncClient(base_url=settings.auth_service_url, timeout=_TIMEOUT) as client:
        return await client.delete(path, headers=headers)


# --- Tokens ---


async def generate_token(
    client_id: str,
    client_secret: str,
    scopes: list[str] | None = None,
    access_ttl: int | None = None,
    refresh_ttl: int | None = None,
    metadata: dict | None = None,
) -> Optional[dict]:
    payload = {"client_id": client_id, "client_secret": client_secret}
    if scopes:
        payload["scopes"] = scopes
    if access_ttl:
        payload["access_ttl"] = access_ttl
    if refresh_ttl:
        payload["refresh_ttl"] = refresh_ttl
    if metadata:
        payload["metadata"] = metadata

    resp = await _post("/api/v1/tokens", json=payload)
    if resp.status_code == 201:
        return resp.json()
    logger.warning("generate_token failed: %s %s", resp.status_code, resp.text)
    return None


async def verify_token(token: str) -> Optional[dict]:
    resp = await _post("/api/v1/tokens/verify", json={"token": token})
    if resp.status_code == 200:
        data = resp.json()
        if data.get("valid"):
            return data.get("token_data")
    return None


async def revoke_token(token_id: str, bearer: str) -> bool:
    resp = await _delete(f"/api/v1/tokens/{token_id}", headers={"Authorization": f"Bearer {bearer}"})
    return resp.status_code == 200


async def revoke_all_tokens(service_id: str, bearer: str) -> int:
    resp = await _delete(
        f"/api/v1/tokens/revoke-all/{service_id}",
        headers={"Authorization": f"Bearer {bearer}"},
    )
    if resp.status_code == 200:
        return resp.json().get("revoked_count", 0)
    return 0


# --- Services ---


async def register_service(
    service_id: str,
    service_name: str,
    client_id: str,
    client_secret: str,
    description: str = "",
    allowed_scopes: list[str] | None = None,
    rate_limit: int = 0,
) -> bool:
    payload = {
        "service_id": service_id,
        "service_name": service_name,
        "client_id": client_id,
        "client_secret": client_secret,
        "description": description,
        "allowed_scopes": allowed_scopes or ["read", "write"],
        "rate_limit": rate_limit,
    }
    resp = await _post("/api/v1/services", json=payload)
    return resp.status_code == 201


async def list_services(bearer: str) -> list[dict]:
    resp = await _get("/api/v1/services", headers={"Authorization": f"Bearer {bearer}"})
    if resp.status_code == 200:
        return resp.json().get("services", [])
    return []


async def delete_service(service_id: str, bearer: str) -> bool:
    resp = await _delete(f"/api/v1/services/{service_id}", headers={"Authorization": f"Bearer {bearer}"})
    return resp.status_code == 200


# --- Health ---


async def health() -> Optional[dict]:
    try:
        resp = await _get("/health")
        return resp.json()
    except Exception as e:
        logger.error("auth-service health check failed: %s", e)
        return None
