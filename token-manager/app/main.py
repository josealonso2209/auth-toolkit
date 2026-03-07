import logging
import os

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
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

# CORS
if settings.cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
        allow_credentials=True,
    )


# Security headers
@app.middleware("http")
async def security_headers(request: Request, call_next):
    response: Response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["Cache-Control"] = "no-store"
    return response


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
