import logging
import os

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.responses import FileResponse

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


# --- SPA: servir frontend React (solo en produccion con build) ---
DIST_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "ui", "dist")

if os.path.isdir(DIST_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(DIST_DIR, "assets")), name="assets")

    @app.get("/{path:path}")
    async def serve_spa(path: str):
        file_path = os.path.join(DIST_DIR, path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(DIST_DIR, "index.html"))
