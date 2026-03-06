import json
import logging
from typing import Optional

import redis

from app.core.config import settings

logger = logging.getLogger("auth-service.redis")


class RedisStore:
    """Almacen de datos en Redis para tokens y servicios."""

    def __init__(self) -> None:
        config: dict = {
            "host": settings.redis_host,
            "port": settings.redis_port,
            "db": settings.redis_db,
            "decode_responses": True,
        }
        if settings.redis_password:
            config["password"] = settings.redis_password

        self.redis = redis.Redis(**config)
        logger.info("Redis: %s:%s (DB %s)", config["host"], config["port"], config["db"])

    def ping(self) -> bool:
        try:
            return self.redis.ping()
        except redis.RedisError as e:
            logger.error("Redis ping failed: %s", e)
            return False

    # --- Tokens ---

    def set_token(self, token_id: str, data: dict, ttl: int) -> None:
        key = f"token:{token_id}"
        self.redis.setex(key, ttl, json.dumps(data))

    def get_token(self, token_id: str) -> Optional[dict]:
        key = f"token:{token_id}"
        raw = self.redis.get(key)
        if raw is None:
            return None
        return json.loads(raw)

    def delete_token(self, token_id: str) -> bool:
        key = f"token:{token_id}"
        return self.redis.delete(key) > 0

    def get_token_ttl(self, token_id: str) -> int:
        key = f"token:{token_id}"
        return self.redis.ttl(key)

    # --- Service token index ---

    def add_to_service_index(self, service_id: str, token_id: str, ttl: int) -> None:
        key = f"service_tokens:{service_id}"
        self.redis.sadd(key, token_id)
        current_ttl = self.redis.ttl(key)
        if current_ttl < ttl:
            self.redis.expire(key, ttl)

    def get_service_token_ids(self, service_id: str) -> list[str]:
        key = f"service_tokens:{service_id}"
        return list(self.redis.smembers(key))

    def remove_from_service_index(self, service_id: str, token_id: str) -> None:
        key = f"service_tokens:{service_id}"
        self.redis.srem(key, token_id)

    def delete_service_index(self, service_id: str) -> None:
        key = f"service_tokens:{service_id}"
        self.redis.delete(key)

    # --- Services ---

    def set_service(self, client_id: str, data: dict) -> None:
        key = f"service:{client_id}"
        self.redis.set(key, json.dumps(data))

    def get_service(self, client_id: str) -> Optional[dict]:
        key = f"service:{client_id}"
        raw = self.redis.get(key)
        if raw is None:
            return None
        return json.loads(raw)

    def delete_service(self, client_id: str) -> bool:
        key = f"service:{client_id}"
        return self.redis.delete(key) > 0

    def get_all_services(self) -> list[dict]:
        services = []
        for key in self.redis.scan_iter("service:*"):
            raw = self.redis.get(key)
            if raw:
                services.append(json.loads(raw))
        return services

    # --- Rate limiting ---

    def check_rate_limit(self, service_id: str, limit: int) -> tuple[bool, int]:
        """Retorna (allowed, current_count). Window de 1 minuto."""
        if limit <= 0:
            return True, 0

        from datetime import datetime, timezone

        window = datetime.now(timezone.utc).strftime("%Y%m%d%H%M")
        key = f"rate:{service_id}:{window}"

        count = self.redis.incr(key)
        if count == 1:
            self.redis.expire(key, 60)

        return count <= limit, count

    # --- Failed attempts / lockout ---

    def increment_failed_attempts(self, service_id: str) -> int:
        key = f"failed:{service_id}"
        count = self.redis.incr(key)
        self.redis.expire(key, settings.lockout_duration)
        return count

    def reset_failed_attempts(self, service_id: str) -> None:
        self.redis.delete(f"failed:{service_id}")

    def lock_service(self, service_id: str) -> None:
        key = f"locked:{service_id}"
        self.redis.setex(key, settings.lockout_duration, "1")
        logger.warning("Service locked: %s", service_id)

    def is_locked(self, service_id: str) -> bool:
        return self.redis.exists(f"locked:{service_id}") > 0


redis_store = RedisStore()
