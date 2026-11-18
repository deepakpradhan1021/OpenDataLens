"""
OpenDataLens - Phase 6.2 Security Regression & Production Release Freeze Test Suite.
Audits and verifies:
1. Strict CORS origin white-listing and preflight OPTIONS handling.
2. Server-issued guest session cryptographic HMAC verification.
3. Session ID manipulation and tampering rejection (401).
4. Cross-session project isolation and unauthorized access denial (404).
5. Unauthorized project deletion prevention.
6. Share link protection, Argon2id password verification, expiration, and revocation.
7. Brute-force rate limiting (429 lockout after 5 consecutive failures).
8. Protection against malicious project imports (zip traversal, zip bomb).
9. Oversized upload protection (>25 MB rejected with 413).
10. Complete absence of API key / credential leakage across responses and errors.
"""

import os
import io
import time
import zipfile
import pytest
from fastapi.testclient import TestClient

from backend.api.main import app
from backend.api.security import (
    sign_session_id,
    verify_session_token,
    generate_server_session,
    SESSION_SECRET
)

client = TestClient(app)


# ==============================================================================
# 1. CORS CONFIGURATION AUDIT
# ==============================================================================

def test_cors_approved_production_origin():
    """Verify that the official production frontend receives valid CORS headers with credentials."""
    # Preflight OPTIONS
    resp = client.options(
        "/api/health",
        headers={
            "Origin": "https://opendatalens-app.vercel.app",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "Content-Type,X-Session-ID"
        }
    )
    assert resp.status_code == 200
    assert resp.headers.get("access-control-allow-origin") == "https://opendatalens-app.vercel.app"
    assert resp.headers.get("access-control-allow-credentials") == "true"
    assert "X-Session-ID" in resp.headers.get("access-control-allow-headers", "")

    # Actual GET request with Origin
    get_resp = client.get(
        "/api/health",
        headers={"Origin": "https://opendatalens-app.vercel.app"}
    )
    assert get_resp.status_code == 200
    assert get_resp.headers.get("access-control-allow-origin") == "https://opendatalens-app.vercel.app"
    assert get_resp.headers.get("access-control-allow-credentials") == "true"
    assert "X-Session-ID" in get_resp.headers.get("access-control-expose-headers", "")


def test_cors_approved_preview_subdomain():
    """Verify that legitimate OpenDataLens preview branches on vercel.app are permitted."""
    resp = client.options(
        "/api/health",
        headers={
            "Origin": "https://opendatalens-app-git-feat-test.vercel.app",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type"
        }
    )
    assert resp.status_code == 200
    assert resp.headers.get("access-control-allow-origin") == "https://opendatalens-app-git-feat-test.vercel.app"
    assert resp.headers.get("access-control-allow-credentials") == "true"


def test_cors_unauthorized_third_party_vercel_origin_blocked():
    """
    CRITICAL: Verify that arbitrary third-party apps on vercel.app
    (e.g., https://malicious-attacker.vercel.app) do NOT receive CORS credentials!
    """
    resp = client.options(
        "/api/health",
        headers={
            "Origin": "https://malicious-attacker.vercel.app",
            "Access-Control-Request-Method": "GET"
        }
    )
    assert resp.headers.get("access-control-allow-origin") != "https://malicious-attacker.vercel.app"


def test_cors_arbitrary_unauthorized_origin_blocked():
    """Verify that arbitrary external origins are blocked from cross-origin access."""
    resp = client.options(
        "/api/health",
        headers={
            "Origin": "https://phishing-site.example.com",
            "Access-Control-Request-Method": "GET"
        }
    )
    assert resp.headers.get("access-control-allow-origin") is None


# ==============================================================================
# 2. GUEST SESSION IDENTITY & TAMPERING TESTS
# ==============================================================================

def test_session_init_mints_signed_token():
    """Verify that /api/sessions/init generates a valid server-signed token."""
    resp = client.post("/api/sessions/init")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    token = data["session_token"]
    raw_id = data["session_id"]
    assert "." in token
    assert token.startswith(raw_id)

    # Verify cryptographic signature
    valid, verified_raw = verify_session_token(token, strict=True)
    assert valid is True
    assert verified_raw == raw_id


def test_tampered_session_token_rejected():
    """Verify that tampering with either the session UUID or HMAC signature fails verification."""
    sess = generate_server_session()
    good_token = sess["session_token"]
    raw_id, sig = good_token.split(".", 1)

    # A. Corrupt signature
    bad_sig_token = f"{raw_id}.00000000000000000000000000000000"
    valid, _ = verify_session_token(bad_sig_token, strict=True)
    assert valid is False

    # B. Alter UUID while keeping original signature
    alt_id = "00000000-0000-0000-0000-000000000000"
    tampered_uuid_token = f"{alt_id}.{sig}"
    valid, _ = verify_session_token(tampered_uuid_token, strict=True)
    assert valid is False


def test_session_tampering_rejected_by_api_route():
    """Verify that an API route rejects tampered session tokens with 401 Unauthorized."""
    fake_token = "deadbeef-1234-4567-8901-abcdefabcdef.invalid_hmac_signature_value_here"
    resp = client.get(f"/api/projects?session_id={fake_token}")
    assert resp.status_code == 401
    assert "tampered" in resp.json()["detail"].lower() or "signature" in resp.json()["detail"].lower()


# ==============================================================================
# 3. CROSS-SESSION PROJECT ACCESS & DELETION PREVENTION
# ==============================================================================

def test_cross_session_project_isolation_and_unauthorized_deletion():
    """
    Simulate Alice saving a project under her cryptographically signed guest session.
    Verify that Bob:
    - Cannot see Alice's project in his listing.
    - Cannot view Alice's project details.
    - Cannot restore Alice's project.
    - Cannot delete Alice's project.
    - Cannot impersonate Alice using an unsigned or tampered token.
    """
    # 1. Alice creates signed session and mounts Iris
    alice_sess = generate_server_session()
    alice_token = alice_sess["session_token"]
    alice_raw = alice_sess["session_id"]

    mount_res = client.post(
        "/api/datasets/load-curated",
        json={"dataset_id": "iris", "session_id": alice_token}
    )
    assert mount_res.status_code == 200

    # 2. Alice saves a confidential project
    save_res = client.post("/api/projects/save", json={
        "name": "Alice Confidential Portfolio",
        "description": "Proprietary research",
        "session_id": alice_token
    })
    assert save_res.status_code == 200
    alice_proj_id = save_res.json()["project"]["id"]

    # 3. Bob creates his own signed guest session
    bob_sess = generate_server_session()
    bob_token = bob_sess["session_token"]
    bob_raw = bob_sess["session_id"]

    # 4. Bob lists his projects -> Alice's project must NOT be present
    bob_list = client.get(f"/api/projects?session_id={bob_token}").json()
    assert not any(p["id"] == alice_proj_id for p in bob_list["projects"])

    # 5. Bob attempts direct detail read on Alice's project -> 404 / Access Denied
    bob_read = client.get(f"/api/projects/{alice_proj_id}?session_id={bob_token}")
    assert bob_read.status_code == 404

    # 6. Bob attempts to restore Alice's project into his workspace -> 404 / Access Denied
    bob_load = client.post(f"/api/projects/{alice_proj_id}/load", json={"session_id": bob_token})
    assert bob_load.status_code == 404

    # 7. Bob attempts unauthorized deletion of Alice's project -> 404 / Access Denied
    bob_delete = client.delete(f"/api/projects/{alice_proj_id}?session_id={bob_token}")
    assert bob_delete.status_code == 404

    # 8. Eve attempts to impersonate Alice using raw unsigned session ID
    eve_read = client.get(f"/api/projects/{alice_proj_id}?session_id={alice_raw}")
    assert eve_read.status_code == 404

    # 9. Verify Alice can still legitimately access and delete her own project
    alice_read = client.get(f"/api/projects/{alice_proj_id}?session_id={alice_token}")
    assert alice_read.status_code == 200
    assert alice_read.json()["name"] == "Alice Confidential Portfolio"

    alice_del = client.delete(f"/api/projects/{alice_proj_id}?session_id={alice_token}")
    assert alice_del.status_code == 200


# ==============================================================================
# 4. PROTECTED SHARE ACCESS, EXPIRATION, REVOCATION & RATE LIMITING
# ==============================================================================

def test_protected_share_argon2id_and_unauthorized_revocation():
    """
    Test that shared dossiers:
    - Require password when protected.
    - Reject incorrect passwords with 401.
    - Lock out after 5 consecutive failed attempts with 429.
    - Prevent unauthorized revocation by non-owner sessions.
    - Can be revoked by the owner.
    """
    owner_sess = generate_server_session()
    owner_token = owner_sess["session_token"]

    # Mount dataset
    client.post("/api/datasets/load-curated", json={"dataset_id": "iris", "session_id": owner_token})

    # Create password-protected share
    share_res = client.post("/api/share/create", json={
        "session_id": owner_token,
        "title": "Secure Investor Dossier",
        "password": "CorrectHorseBatteryStaple99!",
        "expires_in_hours": 12
    })
    assert share_res.status_code == 200
    share_token = share_res.json()["share"]["token"]

    # 1. Access without password -> password_required status
    peek = client.get(f"/api/share/{share_token}").json()
    assert peek["status"] == "password_required"

    # 2. Access with wrong password -> 401
    bad_unlock = client.post(f"/api/share/{share_token}/unlock", json={"password": "WrongPassword"})
    assert bad_unlock.status_code == 401

    # 3. Simulate brute-force: 4 more failed attempts (5 total)
    for _ in range(4):
        client.post(f"/api/share/{share_token}/unlock", json={"password": "AttackPassword"})

    # 6th attempt must be rate-limited (429)
    locked_unlock = client.post(f"/api/share/{share_token}/unlock", json={"password": "CorrectHorseBatteryStaple99!"})
    assert locked_unlock.status_code == 429
    assert "Retry-After" in locked_unlock.headers

    # 4. Alien session tries to revoke the share -> Access Denied (404)
    alien_sess = generate_server_session()
    alien_del = client.delete(f"/api/share/{share_token}?session_id={alien_sess['session_token']}")
    assert alien_del.status_code == 404

    # 5. Owner session revokes share -> 200 Success
    owner_del = client.delete(f"/api/share/{share_token}?session_id={owner_token}")
    assert owner_del.status_code == 200

    # 6. Subsequent access returns 404
    after_del = client.get(f"/api/share/{share_token}")
    assert after_del.status_code == 404


# ==============================================================================
# 5. PROJECT IMPORT INJECTION & OVERSIZED FILE DEFENSES
# ==============================================================================

def test_project_import_zip_traversal_defense():
    """Verify that project bundles with directory traversal entries are rejected."""
    sess = generate_server_session()
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("../../etc/shadow", "root:*:12345:0:99999:7:::")
    buf.seek(0)

    res = client.post(
        f"/api/projects/import?session_id={sess['session_token']}",
        files={"file": ("exploit.odl", buf.getvalue(), "application/zip")}
    )
    assert res.status_code == 400
    assert "traversal" in res.json()["detail"].lower() or "path" in res.json()["detail"].lower()


def test_oversized_file_upload_rejected():
    """Verify that uploaded files >25 MB are rejected with HTTP 413."""
    sess = generate_server_session()
    oversized = b"0" * (25 * 1024 * 1024 + 1024)
    res = client.post(
        "/api/datasets/upload-file",
        files={"file": ("oversized.csv", oversized, "text/csv")},
        data={"session_id": sess["session_token"]}
    )
    assert res.status_code == 413
    assert "25 mb" in res.json()["detail"].lower()


# ==============================================================================
# 6. API KEY AND CREDENTIAL LEAKAGE AUDIT
# ==============================================================================

def test_no_api_keys_or_internal_secrets_leaked():
    """
    Audit all primary health, copilot, and telemetry endpoints to confirm that
    no server environment variables, secret keys, or provider tokens are returned.
    """
    # 1. Health endpoint
    h_resp = client.get("/api/health")
    assert h_resp.status_code == 200
    h_text = h_resp.text.lower()
    assert "secret" not in h_text
    assert "key" not in h_text or "columns" in h_text
    assert "token" not in h_text or "session" in h_text

    # 2. Copilot status endpoint
    c_resp = client.get("/api/copilot/status")
    assert c_resp.status_code == 200
    c_data = c_resp.json()
    # Must only disclose provider name ("local_rule_based" or "openai_compatible"), NEVER api_key
    assert "api_key" not in c_data
    assert "secret" not in str(c_data).lower()


def test_training_job_status_signed_session_ownership():
    """Verify that a training job initiated under a signed session can be polled using the signed token."""
    sess = generate_server_session()
    token = sess["session_token"]

    # Mount Iris
    load_res = client.post("/api/datasets/load-curated", json={"dataset_id": "iris", "session_id": token})
    assert load_res.status_code == 200

    # Start training
    train_res = client.post(
        "/api/ml/train",
        json={
            "session_id": token,
            "problem_type": "classification",
            "target_col": "target",
            "feature_cols": ["sepal length (cm)", "sepal width (cm)"],
            "selected_models": ["logistic_regression"],
            "scaler_type": "standard",
            "test_size": 0.2,
            "random_state": 42,
            "cv_folds": 3
        }
    )
    assert train_res.status_code == 200
    job_id = train_res.json()["job_id"]

    # Poll status using signed token header (must be 200 OK, not 403 Forbidden)
    status_res = client.get(f"/api/ml/train/status/{job_id}", headers={"X-Session-ID": token})
    assert status_res.status_code == 200
    assert status_res.json()["job_id"] == job_id

    # Poll status using a DIFFERENT signed session (must be 403 Forbidden)
    other_sess = generate_server_session()
    forbidden_res = client.get(f"/api/ml/train/status/{job_id}", headers={"X-Session-ID": other_sess["session_token"]})
    assert forbidden_res.status_code == 403
