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

import re
import uuid
import time
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.api.routes import health, datasets, quality, ml, evaluation, reports, drift, copilot, projects, share, sessions, admin
from backend.api.security import verify_session_token, is_valid_raw_session_id, sign_session_id
from core.telemetry import telemetry_collector

app = FastAPI(
    title="OpenDataLens SaaS API",
    description="Backend microservice for AI-powered dataset exploration, automated quality analysis, and leak-free machine learning pipelines.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS Security Setup
ENVIRONMENT = os.getenv("ENVIRONMENT", "production").lower()
is_production = ENVIRONMENT == "production"

# Approved Production Origins
PRODUCTION_ORIGINS = [
    "https://opendatalens-app.vercel.app"
]

# Development / Local Origins (only loaded in non-production or when explicitly passed)
DEV_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000"
]

allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "")
if allowed_origins_env:
    allowed_origins = [orig.strip() for orig in allowed_origins_env.split(",") if orig.strip()]
elif is_production:
    allowed_origins = list(PRODUCTION_ORIGINS)
else:
    allowed_origins = list(PRODUCTION_ORIGINS) + list(DEV_ORIGINS)

# Scoped preview regex: restricts origins strictly to OpenDataLens preview deployments on Vercel
# (e.g., https://opendatalens-app-git-*.vercel.app), never arbitrary third-party vercel apps.
OPENDATALENS_PREVIEW_REGEX = r"^https://opendatalens-app(-[a-zA-Z0-9_-]+)?\.vercel\.app$"

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=OPENDATALENS_PREVIEW_REGEX,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"],
    allow_headers=[
        "Content-Type",
        "Authorization",
        "X-Session-ID",
        "X-Share-Password",
        "X-Admin-Key",
        "X-Request-ID",
        "Accept",
        "Origin",
        "User-Agent"
    ],
    expose_headers=["X-Session-ID", "X-Session-Created", "X-Request-ID", "Retry-After"]
)

UUID_OR_HASH_REGEX = re.compile(r"/[a-f0-9-]{8,}(?=/|$)", re.IGNORECASE)

# Lightweight Performance & Telemetry Instrumentation Middleware
@app.middleware("http")
async def telemetry_middleware(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or request.headers.get("X-Request-ID") or str(uuid.uuid4())
    start_time = time.perf_counter()

    # Route template normalization to prevent cardinality explosion
    raw_path = request.url.path
    route_template = UUID_OR_HASH_REGEX.sub("/{id}", raw_path)

    try:
        response = await call_next(request)
        status_code = response.status_code
    except Exception as exc:
        duration_ms = (time.perf_counter() - start_time) * 1000.0
        telemetry_collector.record_request(route_template, 500, duration_ms)
        raise exc

    duration_ms = (time.perf_counter() - start_time) * 1000.0
    telemetry_collector.record_request(route_template, status_code, duration_ms)

    response.headers["X-Request-ID"] = request_id
    return response

# Guest Session Identity Signing Middleware
@app.middleware("http")
async def guest_session_signature_middleware(request: Request, call_next):
    raw_header = request.headers.get("x-session-id") or request.headers.get("X-Session-ID")
    response = await call_next(request)
    if raw_header and "X-Session-ID" not in response.headers:
        is_valid, _ = verify_session_token(raw_header, strict=True)
        if is_valid:
            response.headers["X-Session-ID"] = raw_header
        elif is_valid_raw_session_id(raw_header):
            response.headers["X-Session-ID"] = sign_session_id(raw_header)
    return response

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
app.include_router(projects.router, prefix="/api")
app.include_router(share.router, prefix="/api")
app.include_router(sessions.router, prefix="/api")
app.include_router(admin.router, prefix="/api")

# Optional Observability Stubs (Dormant unless environment keys configured)
SENTRY_DSN = os.getenv("SENTRY_DSN", "").strip()
if SENTRY_DSN:
    try:
        import sentry_sdk
        sentry_sdk.init(
            dsn=SENTRY_DSN,
            traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.1")),
            environment=ENVIRONMENT
        )
        logger.info("Sentry APM integration initialized successfully.")
    except ImportError:
        logger.warning("SENTRY_DSN configured but sentry-sdk package is not installed.")

OTEL_EXPORTER_ENDPOINT = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "").strip()
if OTEL_EXPORTER_ENDPOINT:
    logger.info("OpenTelemetry exporter configured at %s (dormant stub)", OTEL_EXPORTER_ENDPOINT)


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
