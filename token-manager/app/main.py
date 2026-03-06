import logging

from fastapi import FastAPI

from app.core.config import settings
from app.core.database import Base, engine
from app.core.security import hash_password
from app.models.db import AdminUser, AdminSession, AuditLog, Webhook, WebhookDelivery
from app.routers import audit, auth, services, tokens, users, webhooks

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)
logger = logging.getLogger("token-manager")

app = FastAPI(
    title="Token Manager",
    description="Panel de administracion para el ecosistema de autenticacion",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.include_router(auth.router)
app.include_router(tokens.router)
app.include_router(services.router)
app.include_router(users.router)
app.include_router(webhooks.router)
app.include_router(audit.router)


@app.on_event("startup")
def on_startup():
    # Crear tablas si no existen
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables ensured")

    # Crear usuario admin por defecto si no existe
    from app.core.database import SessionLocal
    db = SessionLocal()
    try:
        admin = db.query(AdminUser).filter(AdminUser.username == "admin").first()
        if not admin:
            admin = AdminUser(
                username="admin",
                email="admin@auth-toolkit.local",
                password_hash=hash_password(settings.admin_default_password),
                role="admin",
            )
            db.add(admin)
            db.commit()
            logger.info("Default admin user created (username: admin)")
    finally:
        db.close()


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "token-manager"}
