"""
Main FastAPI Application Entrypoint for OpenDataLens SaaS.
"""

import os
import sys
import logging
from pathlib import Path

# Add project root to sys.path so 'core' and 'backend' are directly importable
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("OpenDataLens")

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.api.routes import health, datasets, quality, ml, evaluation, reports, drift, copilot

app = FastAPI(
    title="OpenDataLens SaaS API",
    description="Backend microservice for AI-powered dataset exploration, automated quality analysis, and leak-free machine learning pipelines.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS Security Setup
DEFAULT_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "https://opendatalens-app.vercel.app"
]
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "")
if allowed_origins_env:
    allowed_origins = [orig.strip() for orig in allowed_origins_env.split(",") if orig.strip()]
    for d in DEFAULT_ORIGINS:
        if d not in allowed_origins:
            allowed_origins.append(d)
else:
    allowed_origins = DEFAULT_ORIGINS

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"^https://([a-zA-Z0-9-]+\.)*vercel\.app$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"],
    allow_headers=["*"],
    expose_headers=["X-Session-ID"]
)

# Global Exception Handler with Sanitized Production Responses
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled server error on {request.method} {request.url.path}: {exc}")
    is_prod = os.getenv("ENVIRONMENT", "production").lower() == "production"
    error_msg = "An unexpected internal server error occurred. Please try again or check server logs." if is_prod else str(exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "InternalServerError",
            "message": error_msg,
            "path": request.url.path
        }
    )

# Include API Routers
app.include_router(health.router, prefix="/api")
app.include_router(datasets.router, prefix="/api")
app.include_router(quality.router, prefix="/api")
app.include_router(ml.router, prefix="/api")
app.include_router(evaluation.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(drift.router, prefix="/api")
app.include_router(copilot.router, prefix="/api")


@app.get("/")
def root():
    return {
        "platform": "OpenDataLens SaaS API",
        "version": "1.0.0",
        "docs": "/docs",
        "status": "operational"
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("backend.api.main:app", host="0.0.0.0", port=port, reload=True)
