import logging

from fastapi import FastAPI

from app.core.config import settings
from app.routers import health, services, tokens

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)

app = FastAPI(
    title="Auth Service",
    description="Microservicio de autenticacion basado en tokens opacos",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.include_router(tokens.router)
app.include_router(services.router)
app.include_router(health.router)
