import time
from datetime import datetime, timezone

from fastapi import APIRouter
from starlette.responses import JSONResponse

from app.core.redis_store import redis_store
from app.models.schemas import HealthResponse

router = APIRouter(tags=["health"])

_start_time = time.monotonic()
_version = "1.0.0"


@router.get("/health", response_model=HealthResponse)
async def health_check():
    redis_ok = redis_store.ping()
    data = HealthResponse(
        status="healthy" if redis_ok else "degraded",
        redis="connected" if redis_ok else "disconnected",
        version=_version,
        uptime_seconds=round(time.monotonic() - _start_time, 2),
        timestamp=datetime.now(timezone.utc).isoformat(),
    )
    status_code = 200 if redis_ok else 503
    return JSONResponse(content=data.model_dump(), status_code=status_code)
