"""
OpenDataLens - Phase 7.2 Production Telemetry & Monitoring Test Suite.
Audits and verifies:
1. Extended /api/health contract with memory RSS, memory status, requests total, active jobs.
2. In-memory RSS memory measurement across Linux/Windows/Unix.
3. Latency percentile computation (min, avg, p50, p95, p99, max) with bounded ring buffer.
4. Route template normalization preventing cardinality explosion.
5. Protected admin telemetry endpoints (/api/admin/telemetry, /api/admin/metrics/reset).
6. Constant-time admin key validation and safe disabling (503) when unconfigured.
7. Brute-force rate limiting (429 lockout after 5 consecutive failed admin attempts).
8. Absence of private dataset rows, credentials, or session tokens in telemetry snapshot.
9. X-Request-ID propagation across middleware.
"""

import os
import time
import pytest
from fastapi.testclient import TestClient

from backend.api.main import app
from core.telemetry import telemetry_collector, TelemetryCollector, MEMORY_WARNING_MB, MEMORY_CRITICAL_MB

client = TestClient(app)

TEST_ADMIN_KEY = "test_opendatalens_secret_admin_key_2026"


# ==============================================================================
# 1. EXTENDED HEALTH CHECK AUDIT
# ==============================================================================

def test_health_endpoint_extended_contract():
    """Verify that /api/health returns backward-compatible fields plus telemetry additions."""
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()

    # Pre-existing fields
    assert data["status"] in ("ok", "operational")
    assert data["version"] == "1.0.0"
    assert data["platform"] == "OpenDataLens SaaS"
    assert "timestamp" in data
    assert "uptime_seconds" in data
    assert "active_sessions" in data

    # Phase 7.2 telemetry additions
    assert "memory_rss_mb" in data
    assert isinstance(data["memory_rss_mb"], (int, float))
    assert data["memory_rss_mb"] > 0
    assert data["memory_status"] in ("healthy", "warning", "critical")
    assert "requests_total" in data
    assert isinstance(data["requests_total"], int)
    assert "active_jobs" in data
    assert isinstance(data["active_jobs"], int)


# ==============================================================================
# 2. IN-MEMORY RESOURCE MEASUREMENT
# ==============================================================================

def test_telemetry_rss_memory_reading():
    """Verify that get_process_memory_mb reads actual process memory."""
    mem_mb = telemetry_collector.get_process_memory_mb()
    assert isinstance(mem_mb, float)
    assert mem_mb > 0.0
    # Process memory should be reasonable (< 512 MB in test environment)
    assert mem_mb < 512.0


def test_telemetry_memory_status_and_critical_check():
    """Verify healthy, warning, and critical classification."""
    status, rss = telemetry_collector.get_memory_status()
    assert status in ("healthy", "warning", "critical")
    assert rss > 0

    # Test critical threshold helper
    if rss >= MEMORY_CRITICAL_MB:
        assert telemetry_collector.is_memory_critical() is True
    else:
        assert telemetry_collector.is_memory_critical() is False


def test_telemetry_cpu_percent():
    """Verify that get_cpu_percent returns a valid percentage between 0 and 100."""
    cpu_pct = telemetry_collector.get_cpu_percent()
    assert isinstance(cpu_pct, (int, float))
    assert 0.0 <= cpu_pct <= 100.0


# ==============================================================================
# 3. LATENCY CALCULATIONS & CIRCULAR BUFFER BOUNDS
# ==============================================================================

def test_telemetry_latency_percentiles():
    """Verify correct calculation of min, avg, p50, p95, p99, and max."""
    telemetry_collector.reset_metrics()

    # Record 100 known latencies: 1ms to 100ms
    for i in range(1, 101):
        telemetry_collector.record_request("/api/test", 200, float(i))

    lat = telemetry_collector.get_latency_percentiles()
    assert lat["count"] == 100
    assert lat["min_ms"] == 1.0
    assert lat["max_ms"] == 100.0
    assert lat["avg_ms"] == 50.5
    assert lat["p50_ms"] == 50.0
    assert lat["p95_ms"] == 95.0
    assert lat["p99_ms"] == 99.0


def test_telemetry_buffer_bounds():
    """Verify circular ring buffer never exceeds maxlen (500 items)."""
    telemetry_collector.reset_metrics()

    # Feed 700 requests
    for i in range(700):
        telemetry_collector.record_request("/api/bench", 200, float(i))

    lat = telemetry_collector.get_latency_percentiles()
    assert lat["count"] == 500  # Strictly bounded by maxlen


# ==============================================================================
# 4. ROUTE NORMALIZATION & CARDINALITY PREVENTION
# ==============================================================================

def test_telemetry_middleware_and_request_id():
    """Verify middleware injects X-Request-ID and tracks status codes."""
    resp = client.get("/api/health")
    assert "X-Request-ID" in resp.headers
    assert len(resp.headers["X-Request-ID"]) > 0


def test_route_normalization_on_uuid():
    """Verify paths with UUIDs or tokens are aggregated under normalized route templates."""
    fake_token = "550e8400-e29b-41d4-a716-446655440000"
    # Query an endpoint with a UUID (it may 404, but telemetry tracks the route template)
    client.get(f"/api/share/{fake_token}")

    snapshot = telemetry_collector.get_telemetry_snapshot()
    routes = [r["route"] for r in snapshot.get("slow_endpoints", [])]

    # Verify that raw UUID is not in the routes table, but normalized to /{id}
    for r in routes:
        assert fake_token not in r, f"Raw UUID was leaked into route metric table: {r}"


# ==============================================================================
# 5. ADMIN AUTHENTICATION & SECURITY CONTROLS
# ==============================================================================

def test_admin_telemetry_unconfigured_returns_503(monkeypatch):
    """If OPENDATALENS_ADMIN_KEY is not configured, admin endpoints must return 503 Service Unavailable."""
    monkeypatch.delenv("OPENDATALENS_ADMIN_KEY", raising=False)

    resp = client.get("/api/admin/telemetry")
    assert resp.status_code == 503
    assert "OPENDATALENS_ADMIN_KEY is not configured" in resp.json()["detail"]


def test_admin_telemetry_missing_or_invalid_key_returns_401(monkeypatch):
    """When OPENDATALENS_ADMIN_KEY is configured, requests without key or with wrong key return 401."""
    monkeypatch.setenv("OPENDATALENS_ADMIN_KEY", TEST_ADMIN_KEY)

    # 1. Missing header
    resp = client.get("/api/admin/telemetry")
    assert resp.status_code == 401

    # 2. Wrong key via X-Admin-Key
    resp2 = client.get("/api/admin/telemetry", headers={"X-Admin-Key": "wrong_key_123"})
    assert resp2.status_code == 401

    # 3. Wrong key via Authorization header
    resp3 = client.get("/api/admin/telemetry", headers={"Authorization": "Bearer bad_pass"})
    assert resp3.status_code == 401


def test_admin_telemetry_valid_key_authorized(monkeypatch):
    """Valid key via X-Admin-Key or Authorization Bearer returns 200 OK with full snapshot."""
    monkeypatch.setenv("OPENDATALENS_ADMIN_KEY", TEST_ADMIN_KEY)

    # X-Admin-Key header
    resp = client.get("/api/admin/telemetry", headers={"X-Admin-Key": TEST_ADMIN_KEY})
    assert resp.status_code == 200
    data = resp.json()
    assert "system" in data
    assert "requests" in data
    assert "latency" in data
    assert "events" in data

    # Bearer header
    resp2 = client.get("/api/admin/verify", headers={"Authorization": f"Bearer {TEST_ADMIN_KEY}"})
    assert resp2.status_code == 200
    assert resp2.json()["status"] == "authenticated"


def test_admin_metrics_reset_endpoint(monkeypatch):
    """Admin can reset latency ring buffer and throughput counters."""
    monkeypatch.setenv("OPENDATALENS_ADMIN_KEY", TEST_ADMIN_KEY)

    # Add 10 dummy requests
    for _ in range(10):
        telemetry_collector.record_request("/api/test_reset", 200, 42.0)
    assert telemetry_collector.get_latency_percentiles()["count"] >= 10

    # Call reset via HTTP endpoint
    resp = client.post("/api/admin/metrics/reset", headers={"X-Admin-Key": TEST_ADMIN_KEY})
    assert resp.status_code == 200
    assert resp.json()["status"] == "reset"

    # Confirm previous dummy requests were wiped, leaving only the reset request itself recorded by middleware
    assert telemetry_collector.get_latency_percentiles()["count"] <= 1
    assert "/api/test_reset" not in telemetry_collector._route_metrics

    # Calling reset_metrics directly leaves count strictly at 0
    telemetry_collector.reset_metrics()
    assert telemetry_collector.get_latency_percentiles()["count"] == 0


def test_admin_rate_limiting_lockout(monkeypatch):
    """5 consecutive failed admin attempts from same IP results in 429 Too Many Requests lockout."""
    monkeypatch.setenv("OPENDATALENS_ADMIN_KEY", TEST_ADMIN_KEY)
    test_ip = "192.168.1.105"

    headers = {
        "X-Admin-Key": "wrong_password_attempt",
        "X-Forwarded-For": test_ip
    }

    # First 4 failed attempts -> 401
    for _ in range(4):
        resp = client.get("/api/admin/telemetry", headers=headers)
        assert resp.status_code == 401

    # 5th attempt -> triggers lockout -> 429
    resp5 = client.get("/api/admin/telemetry", headers=headers)
    assert resp5.status_code == 429
    assert "locked for" in resp5.json()["detail"].lower()
    assert "Retry-After" in resp5.headers

    # Subsequent attempt even with correct key is blocked while locked
    blocked_resp = client.get(
        "/api/admin/telemetry",
        headers={"X-Admin-Key": TEST_ADMIN_KEY, "X-Forwarded-For": test_ip}
    )
    assert blocked_resp.status_code == 429

    # Clean up lockouts for subsequent tests
    telemetry_collector.reset_admin_lockouts()


# ==============================================================================
# 6. ZERO LEAKAGE OF DATASETS, TOKENS, OR CREDENTIALS
# ==============================================================================

def test_telemetry_snapshot_scrubbed_clean(monkeypatch):
    """Verify telemetry snapshot contains strictly operational metrics and zero user data."""
    monkeypatch.setenv("OPENDATALENS_ADMIN_KEY", TEST_ADMIN_KEY)

    resp = client.get("/api/admin/telemetry", headers={"X-Admin-Key": TEST_ADMIN_KEY})
    assert resp.status_code == 200
    text = resp.text

    # Forbidden private strings
    assert TEST_ADMIN_KEY not in text
    assert "session_token" not in text
    assert "dataset_records" not in text
    assert "raw_csv" not in text
    assert "argon2" not in text


# ==============================================================================
# 7. ANTI-SPOOFING & REVERSE PROXY RATE LIMITING
# ==============================================================================

def test_admin_rate_limiting_anti_spoofing_rotating_forwarded(monkeypatch):
    """
    Direct untrusted peer cannot bypass rate limiting by rotating client-supplied X-Forwarded-For.
    Client socket IP is enforced, causing lockout at attempt 5.
    """
    monkeypatch.setenv("OPENDATALENS_ADMIN_KEY", TEST_ADMIN_KEY)
    telemetry_collector.reset_admin_lockouts()

    untrusted_client = TestClient(app, client=("198.51.100.99", 54321))
    statuses = []
    for i in range(10):
        resp = untrusted_client.get(
            "/api/admin/verify",
            headers={"X-Admin-Key": "wrong_key", "X-Forwarded-For": f"10.0.0.{i}"}
        )
        statuses.append(resp.status_code)

    telemetry_collector.reset_admin_lockouts()

    # Attempts 1-4 should be 401; attempt 5+ must be 429
    assert statuses[:4] == [401, 401, 401, 401]
    assert statuses[4:] == [429, 429, 429, 429, 429, 429]


def test_admin_reverse_proxy_rightmost_untrusted_resolution(monkeypatch):
    """
    When behind a trusted reverse proxy (e.g. 127.0.0.1 or Render internal),
    rightmost untrusted client in X-Forwarded-For is extracted, ignoring client-injected spoofed headers.
    """
    monkeypatch.setenv("OPENDATALENS_ADMIN_KEY", TEST_ADMIN_KEY)
    telemetry_collector.reset_admin_lockouts()

    # Immediate peer is 127.0.0.1 (trusted reverse proxy)
    trusted_proxy_client = TestClient(app, client=("127.0.0.1", 8080))

    # Attacker tries to spoof client IP by prefixing with rotating dummy IP, but proxy appends attacker's IP
    real_attacker_ip = "203.0.113.88"
    statuses = []
    for i in range(7):
        # Header formatted by proxy: spoofed, real_attacker_ip
        proxy_header = f"1.2.3.{i}, {real_attacker_ip}"
        resp = trusted_proxy_client.get(
            "/api/admin/verify",
            headers={"X-Admin-Key": "wrong_key", "X-Forwarded-For": proxy_header}
        )
        statuses.append(resp.status_code)

    telemetry_collector.reset_admin_lockouts()

    assert statuses[:4] == [401, 401, 401, 401]
    assert statuses[4:] == [429, 429, 429]


def test_proxy_trusted_multi_hop_chain(monkeypatch):
    """
    Trusted proxy with a valid multi-hop chain:
    Client (198.51.100.77) -> Proxy2 (172.16.0.2) -> Proxy1 (10.0.0.1) -> Backend.
    With TRUSTED_PROXIES="10.0.0.0/8, 172.16.0.0/12", correctly identifies real client 198.51.100.77.
    """
    monkeypatch.setenv("OPENDATALENS_ADMIN_KEY", TEST_ADMIN_KEY)
    monkeypatch.setenv("TRUSTED_PROXIES", "10.0.0.0/8, 172.16.0.0/12")
    telemetry_collector.reset_admin_lockouts()

    # Direct socket peer is Proxy1 (10.0.0.1)
    proxy_client = TestClient(app, client=("10.0.0.1", 12345))

    # X-Forwarded-For: client, proxy2
    chain_header = "198.51.100.77, 172.16.0.2"
    statuses = []
    for _ in range(5):
        resp = proxy_client.get(
            "/api/admin/verify",
            headers={"X-Admin-Key": "wrong_key", "X-Forwarded-For": chain_header}
        )
        statuses.append(resp.status_code)

    telemetry_collector.reset_admin_lockouts()

    # Client 198.51.100.77 gets locked out on 5th attempt
    assert statuses == [401, 401, 401, 401, 429]


def test_proxy_untrusted_private_network_peer_spoofing(monkeypatch):
    """
    Untrusted private-network peer (e.g. 10.0.0.5 or 192.168.1.50) attempts header spoofing
    without being explicitly configured in TRUSTED_PROXIES.
    RFC 1918 addresses are NOT trusted by default (fail-closed); socket IP is enforced, headers ignored.
    """
    monkeypatch.setenv("OPENDATALENS_ADMIN_KEY", TEST_ADMIN_KEY)
    monkeypatch.delenv("TRUSTED_PROXIES", raising=False)
    telemetry_collector.reset_admin_lockouts()

    # Private network peer 10.0.0.5 connects directly
    untrusted_private_client = TestClient(app, client=("10.0.0.5", 55555))

    # Attempts to bypass rate limiting by rotating X-Forwarded-For
    statuses = []
    for i in range(7):
        resp = untrusted_private_client.get(
            "/api/admin/verify",
            headers={"X-Admin-Key": "wrong_key", "X-Forwarded-For": f"203.0.113.{i}"}
        )
        statuses.append(resp.status_code)

    telemetry_collector.reset_admin_lockouts()

    # Socket IP 10.0.0.5 is enforced and locked out on attempt 5
    assert statuses[:4] == [401, 401, 401, 401]
    assert statuses[4:] == [429, 429, 429]


def test_proxy_malformed_forwarded_headers(monkeypatch):
    """
    Malformed forwarded headers containing non-IP tokens or script injection attempts
    must be safely rejected and fail closed to the socket peer.
    """
    monkeypatch.setenv("OPENDATALENS_ADMIN_KEY", TEST_ADMIN_KEY)
    telemetry_collector.reset_admin_lockouts()

    # Trusted proxy peer 127.0.0.1
    proxy_client = TestClient(app, client=("127.0.0.1", 9999))

    malformed_header = "not-an-ip, 999.999.999.999, <script>alert(1)</script>"
    statuses = []
    for _ in range(5):
        resp = proxy_client.get(
            "/api/admin/verify",
            headers={"X-Admin-Key": "wrong_key", "X-Forwarded-For": malformed_header}
        )
        statuses.append(resp.status_code)

    telemetry_collector.reset_admin_lockouts()

    # Safely rejected and fails closed to peer 127.0.0.1, locking it out on attempt 5
    assert statuses == [401, 401, 401, 401, 429]


def test_proxy_missing_or_invalid_configuration(monkeypatch):
    """
    Missing or invalid TRUSTED_PROXIES configuration (e.g. invalid CIDRs)
    fails closed to only loopback addresses.
    """
    monkeypatch.setenv("OPENDATALENS_ADMIN_KEY", TEST_ADMIN_KEY)
    monkeypatch.setenv("TRUSTED_PROXIES", "invalid_cidr, not_an_ip, 300.300.300.300/32")
    telemetry_collector.reset_admin_lockouts()

    # Non-loopback peer (172.16.5.5) must NOT be trusted
    client_non_loopback = TestClient(app, client=("172.16.5.5", 44444))

    statuses = []
    for i in range(6):
        resp = client_non_loopback.get(
            "/api/admin/verify",
            headers={"X-Admin-Key": "wrong_key", "X-Forwarded-For": f"198.51.100.{i}"}
        )
        statuses.append(resp.status_code)

    telemetry_collector.reset_admin_lockouts()

    # Locked out on socket IP 172.16.5.5 on attempt 5
    assert statuses[:4] == [401, 401, 401, 401]
    assert statuses[4:] == [429, 429]


def test_proxy_production_configuration(monkeypatch):
    """
    Production proxy configuration:
    Declaring TRUSTED_PROXIES="10.50.0.0/16" correctly trusts Render/VPC internal proxies
    in that subnet and extracts the forwarded client IP.
    """
    monkeypatch.setenv("OPENDATALENS_ADMIN_KEY", TEST_ADMIN_KEY)
    monkeypatch.setenv("TRUSTED_PROXIES", "10.50.0.0/16")
    telemetry_collector.reset_admin_lockouts()

    # Render load balancer proxy in 10.50.0.0/16
    render_proxy_client = TestClient(app, client=("10.50.12.34", 10000))
    client_ip = "198.51.100.42"

    statuses = []
    for _ in range(5):
        resp = render_proxy_client.get(
            "/api/admin/verify",
            headers={"X-Admin-Key": "wrong_key", "X-Forwarded-For": client_ip}
        )
        statuses.append(resp.status_code)

    telemetry_collector.reset_admin_lockouts()

    # Client IP 198.51.100.42 is identified and locked out on attempt 5
    assert statuses == [401, 401, 401, 401, 429]


# ==============================================================================
# 8. CRITICAL MEMORY THROTTLING CHECKS
# ==============================================================================

def test_memory_critical_protection_endpoints(monkeypatch):
    """
    Heavy endpoints (/upload-file, /load-curated, /load-hf, /train) return HTTP 503
    with Retry-After: 30 when memory is critical (>450 MB).
    """
    monkeypatch.setattr(telemetry_collector, "is_memory_critical", lambda: True)

    # 1. upload-file
    dummy_csv = b"a,b,c\n1,2,3"
    resp_upload = client.post(
        "/api/datasets/upload-file",
        files={"file": ("test.csv", dummy_csv, "text/csv")},
        data={"session_id": "test_mem_session"}
    )
    assert resp_upload.status_code == 503
    assert "critically constrained" in resp_upload.json()["detail"].lower()
    assert resp_upload.headers.get("retry-after") == "30"

    # 2. load-curated
    resp_curated = client.post(
        "/api/datasets/load-curated",
        json={"dataset_id": "iris", "session_id": "test_mem_session"}
    )
    assert resp_curated.status_code == 503
    assert resp_curated.headers.get("retry-after") == "30"

    # 3. load-hf
    resp_hf = client.post(
        "/api/datasets/load-hf",
        json={"dataset_name": "imdb", "session_id": "test_mem_session", "max_rows": 10}
    )
    assert resp_hf.status_code == 503
    assert resp_hf.headers.get("retry-after") == "30"

    # 4. train
    resp_train = client.post(
        "/api/ml/train",
        json={
            "session_id": "test_mem_session",
            "problem_type": "classification",
            "target_col": "target",
            "feature_cols": ["feat1", "feat2"],
            "selected_models": ["logistic_regression"]
        }
    )
    assert resp_train.status_code == 503
    assert resp_train.headers.get("retry-after") == "30"
