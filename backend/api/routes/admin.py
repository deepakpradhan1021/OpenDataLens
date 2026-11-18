"""
OpenDataLens — Admin Telemetry & Metrics Router
Phase 7.2: Protected Monitoring Endpoints with Constant-Time Auth & IP Rate Limiting
"""

import os
import logging
from typing import Dict, Any, Optional
from fastapi import APIRouter, Request, HTTPException, status, Header
from core.telemetry import telemetry_collector

logger = logging.getLogger("OpenDataLens.Admin")

router = APIRouter(prefix="/admin", tags=["Admin Telemetry"])


def extract_admin_key(
    request: Request,
    x_admin_key: Optional[str] = Header(None, alias="X-Admin-Key"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
) -> Optional[str]:
    """
    Extracts the admin key from either 'X-Admin-Key' or 'Authorization: Bearer <key>'.
    """
    if x_admin_key and x_admin_key.strip():
        return x_admin_key.strip()

    if authorization and authorization.strip():
        parts = authorization.strip().split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            return parts[1].strip()
        elif len(parts) == 1:
            return parts[0].strip()

    return None


def get_client_ip(request: Request) -> str:
    """
    Retrieves real client IP taking forwarded headers into account safely.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        # First IP in the comma-separated chain is the client
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"


def verify_admin_access(request: Request, admin_key: Optional[str]) -> None:
    """
    Validates admin credentials using constant-time comparison and enforces rate limiting.
    Raises HTTPException (503, 429, or 401) on failure.
    """
    client_ip = get_client_ip(request)
    success, reason = telemetry_collector.verify_admin_key(admin_key, client_ip)

    if success:
        return

    if reason == "unconfigured":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin telemetry is disabled. OPENDATALENS_ADMIN_KEY is not configured on the server.",
        )

    if reason.startswith("locked:"):
        seconds = reason.split(":")[1]
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many failed admin authentication attempts. IP locked for {seconds} seconds.",
            headers={"Retry-After": str(seconds)},
        )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or missing admin key.",
        headers={"WWW-Authenticate": "Bearer"},
    )


@router.get("/verify")
def verify_admin_key_endpoint(
    request: Request,
    x_admin_key: Optional[str] = Header(None, alias="X-Admin-Key"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
) -> Dict[str, Any]:
    """
    Quick status check for frontend key verification.
    """
    key = extract_admin_key(request, x_admin_key, authorization)
    verify_admin_access(request, key)
    return {"status": "authenticated", "message": "Admin authorization verified successfully."}


@router.get("/telemetry")
def get_admin_telemetry(
    request: Request,
    x_admin_key: Optional[str] = Header(None, alias="X-Admin-Key"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
) -> Dict[str, Any]:
    """
    Returns complete, sanitized production telemetry snapshot.
    Guaranteed zero leakage of dataset contents, session tokens, or API credentials.
    """
    key = extract_admin_key(request, x_admin_key, authorization)
    verify_admin_access(request, key)

    snapshot = telemetry_collector.get_telemetry_snapshot()
    return snapshot


@router.post("/metrics/reset")
def reset_admin_metrics(
    request: Request,
    x_admin_key: Optional[str] = Header(None, alias="X-Admin-Key"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
) -> Dict[str, Any]:
    """
    Resets latency ring buffer and throughput counters.
    """
    key = extract_admin_key(request, x_admin_key, authorization)
    verify_admin_access(request, key)

    telemetry_collector.reset_metrics()
    return {"status": "reset", "message": "Telemetry metrics and buffers have been successfully reset."}
