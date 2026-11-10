"""Health check route."""

from fastapi import APIRouter
from backend.api.models import HealthResponse

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthResponse)
def get_health():
    return HealthResponse(
        status="ok",
        version="1.0.0",
        platform="OpenDataLens SaaS"
    )
