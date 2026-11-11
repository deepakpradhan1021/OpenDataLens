"""Dynamic Health check route for OpenDataLens SaaS."""

import time
from datetime import datetime, timezone
from fastapi import APIRouter
from backend.api.models import HealthResponse
from backend.api.session_store import store

router = APIRouter(tags=["Health"])

START_TIME = time.time()


@router.get("/health", response_model=HealthResponse)
def get_health():
    uptime = round(time.time() - START_TIME, 2)
    now_iso = datetime.now(timezone.utc).isoformat()
    active_count = store.get_active_session_count()

    return HealthResponse(
        status="ok",
        version="1.0.0",
        platform="OpenDataLens SaaS",
        timestamp=now_iso,
        uptime_seconds=uptime,
        active_sessions=active_count
    )
