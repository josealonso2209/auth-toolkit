from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Redis
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_db: int = 0
    redis_password: str | None = None

    # Token defaults
    default_access_ttl: int = 3600  # 1 hora
    default_refresh_ttl: int = 2592000  # 30 dias

    # Cache local (cachetools)
    local_cache_ttl: int = 5  # segundos
    local_cache_maxsize: int = 10000

    # Seguridad
    max_failed_attempts: int = 5
    lockout_duration: int = 300  # 5 minutos

    # CORS
    cors_origins: str = ""

    # Logging
    log_level: str = "info"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
