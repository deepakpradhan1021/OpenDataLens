"""
OpenDataLens — Admin Telemetry & Metrics Router
Phase 7.2: Protected Monitoring Endpoints with Constant-Time Auth & IP Rate Limiting
"""

import os
import ipaddress
import logging
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, Request, HTTPException, status, Header
from core.telemetry import telemetry_collector

logger = logging.getLogger("OpenDataLens.Admin")

router = APIRouter(prefix="/admin", tags=["Admin Telemetry"])

# Default RFC 1918 / loopback / private networks considered trusted reverse proxies
DEFAULT_TRUSTED_PROXIES: List[ipaddress.IPv4Network | ipaddress.IPv6Network] = [
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
]


def _get_trusted_networks() -> List[Any]:
    networks = list(DEFAULT_TRUSTED_PROXIES)
    extra = os.getenv("TRUSTED_PROXIES", "").strip()
    if extra:
        for item in extra.split(","):
            item = item.strip()
            if item:
                try:
                    networks.append(ipaddress.ip_network(item, strict=False))
                except ValueError:
                    logger.warning(f"Invalid network in TRUSTED_PROXIES environment variable: {item}")
    return networks


def is_trusted_peer(host: str) -> bool:
    """Checks whether the immediate connection peer is a trusted reverse proxy."""
    if not host:
        return False
    try:
        ip = ipaddress.ip_address(host)
        trusted = _get_trusted_networks()
        return any(ip in net for net in trusted)
    except ValueError:
        return False


def get_client_ip(request: Request) -> str:
    """
    Resolves client IP securely against IP spoofing.
    - If the direct socket peer (request.client.host) is NOT a trusted proxy,
      we return request.client.host directly. Client-supplied headers are completely ignored.
    - If immediate socket peer is a trusted reverse proxy (e.g. Render internal proxy),
      we traverse the X-Forwarded-For chain in reverse (right to left) and return the first
      IP that is not a trusted proxy (i.e. the real client that connected to the proxy).
    - If all IPs in the chain are trusted proxies, returns the leftmost valid IP.
    - Falls back to request.client.host or '127.0.0.1' if parsing fails.
    """
    peer = request.client.host if request.client else "127.0.0.1"

    # If the direct socket peer is NOT a trusted proxy, do NOT trust any forwarding headers!
    if not is_trusted_peer(peer):
        return peer

    # Peer is a trusted reverse proxy; safely inspect X-Forwarded-For
    forwarded = request.headers.get("x-forwarded-for")
    if not forwarded:
        # Check CF-Connecting-IP if behind Cloudflare and peer is trusted
        cf_ip = request.headers.get("cf-connecting-ip")
        if cf_ip:
            cf_ip = cf_ip.strip()
            try:
                ipaddress.ip_address(cf_ip)
                return cf_ip
            except ValueError:
                pass
        return peer

    # Parse X-Forwarded-For from right to left (most recent downstream first)
    raw_ips = [ip.strip() for ip in forwarded.split(",") if ip.strip()]
    if not raw_ips:
        return peer

    for ip_str in reversed(raw_ips):
        try:
            ipaddress.ip_address(ip_str)
            if not is_trusted_peer(ip_str):
                return ip_str
        except ValueError:
            continue

    return raw_ips[0]


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
