from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    auth_service_url: str = "http://auth-service:8100"
    database_url: str = "postgresql://auth_toolkit:auth_toolkit@postgres:5432/auth_toolkit"
    secret_key: str = "change-me-in-production"
    admin_default_password: str = "admin"
    cors_origins: str = ""
    log_level: str = "info"

    # Celery
    celery_broker_url: str = "redis://:auth_toolkit@redis:6379/1"
    celery_result_backend: str = "redis://:auth_toolkit@redis:6379/2"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
