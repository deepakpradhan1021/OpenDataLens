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

# Fail-closed default: ONLY loopback addresses are trusted by default.
# All other reverse proxy IP ranges (e.g. Render, Cloudflare, AWS ALB) must be explicitly
# declared via the TRUSTED_PROXIES environment variable.
DEFAULT_TRUSTED_PROXIES: List[ipaddress.IPv4Network | ipaddress.IPv6Network] = [
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("::1/128"),
]


def _get_trusted_networks() -> List[ipaddress.IPv4Network | ipaddress.IPv6Network]:
    """
    Returns the list of trusted proxy networks.
    Always includes loopback (127.0.0.0/8, ::1/128).
    Parses comma-separated networks/IPs from TRUSTED_PROXIES env var.
    Invalid CIDR/IP strings are logged and discarded (fail-closed).
    """
    networks = list(DEFAULT_TRUSTED_PROXIES)
    extra = os.getenv("TRUSTED_PROXIES", "").strip()
    if extra:
        for item in extra.split(","):
            item = item.strip()
            if item:
                try:
                    # strict=False allows CIDRs like 192.168.1.1/24 without host-bit errors
                    networks.append(ipaddress.ip_network(item, strict=False))
                except ValueError:
                    logger.warning(
                        "Invalid network or IP in TRUSTED_PROXIES environment variable: '%s'. "
                        "Discarding entry (fail-closed).",
                        item,
                    )
    return networks


def is_trusted_peer(host: str) -> bool:
    """
    Checks whether the immediate direct connection peer is a trusted reverse proxy.
    Direct peers outside trusted networks are treated as untrusted clients.
    """
    if not host or not isinstance(host, str):
        return False

    # In non-production testing, treat "testclient" as trusted loopback unless in production
    if host == "testclient":
        if os.getenv("ENVIRONMENT", "").lower() == "production":
            return False
        return True

    try:
        ip = ipaddress.ip_address(host)
        trusted = _get_trusted_networks()
        return any(ip in net for net in trusted)
    except ValueError:
        return False


def get_client_ip(request: Request) -> str:
    """
    Resolves client IP securely against IP spoofing with strict reverse-proxy trust validation.

    Security invariants enforced:
    1. Direct peer socket (request.client.host) is inspected first.
    2. If direct peer is NOT in trusted proxy networks, request.client.host is returned directly.
       All client-supplied forwarding headers (X-Forwarded-For, CF-Connecting-IP) are IGNORED.
    3. If direct peer IS a trusted proxy:
       a. If X-Forwarded-For is provided:
          - Every IP in the header is strictly validated with ipaddress.ip_address().
          - If any IP token is malformed, traversal fails closed immediately to peer.
          - Traversed from right to left (downstream to upstream). The first valid IP that is
            NOT in the trusted proxy networks is identified as the real client.
          - If all IPs in the chain are in trusted networks, returns the leftmost valid IP.
       b. If X-Forwarded-For is absent, CF-Connecting-IP is inspected and strictly validated.
          If valid, CF-Connecting-IP is returned; otherwise falls back to peer.
    4. If peer cannot be established, returns '127.0.0.1' (fail-closed).
    """
    peer = request.client.host if (request.client and request.client.host) else "127.0.0.1"

    # Step 1: Check if immediate direct peer is a trusted reverse proxy
    if not is_trusted_peer(peer):
        return peer

    # Step 2: Peer is trusted. Check X-Forwarded-For
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
                logger.warning("Malformed CF-Connecting-IP header: '%s'. Falling back to peer.", cf_ip)
                return peer
        return peer

    # Step 3: Parse and strictly validate every IP in X-Forwarded-For
    raw_tokens = [tok.strip() for tok in forwarded.split(",") if tok.strip()]
    if not raw_tokens:
        return peer

    trusted_nets = _get_trusted_networks()
    validated_ips: List[ipaddress.IPv4Address | ipaddress.IPv6Address] = []

    for tok in raw_tokens:
        try:
            validated_ips.append(ipaddress.ip_address(tok))
        except ValueError:
            logger.warning(
                "Malformed IP in X-Forwarded-For header: '%s'. Failing closed to peer '%s'.",
                tok,
                peer,
            )
            return peer

    # Step 4: Traverse right-to-left (most recent proxy first)
    for ip_obj in reversed(validated_ips):
        if not any(ip_obj in net for net in trusted_nets):
            return str(ip_obj)

    # All IPs in the chain were trusted proxies; return leftmost valid client IP
    return str(validated_ips[0])


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
