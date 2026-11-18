"""
OpenDataLens - Security and Guest Session Cryptographic Identity Module.
Provides HMAC-SHA256 token signing and verification for guest sessions,
preventing session impersonation, token tampering, and unauthorized cross-session access.
"""

import os
import hmac
import hashlib
import uuid
import re
import time
from typing import Tuple, Optional, Dict, Any

# Session Secret Key configuration
SESSION_SECRET = os.environ.get("OPENDATALENS_SECRET_KEY") or os.environ.get("SECRET_KEY") or "odl-prod-session-security-secret-key-32b-2026"
if isinstance(SESSION_SECRET, str):
    SESSION_SECRET_BYTES = SESSION_SECRET.encode("utf-8")
else:
    SESSION_SECRET_BYTES = bytes(SESSION_SECRET)

# Strict verification is enabled by default in production or when explicitly configured
ENVIRONMENT = os.environ.get("ENVIRONMENT", "production").lower()
DEFAULT_STRICT = (ENVIRONMENT == "production") or (os.environ.get("STRICT_SESSION_VERIFICATION", "true").lower() in ["true", "1", "yes"])

# Pattern for valid raw session IDs (UUIDv4 or safe slug)
RAW_ID_PATTERN = re.compile(r"^[a-zA-Z0-9_-]{8,64}$")
TOKEN_PATTERN = re.compile(r"^[a-zA-Z0-9_.-]{8,128}$")


def is_valid_raw_session_id(session_id: Optional[str]) -> bool:
    """Validate format of raw UUID or slug."""
    if not session_id or not isinstance(session_id, str):
        return False
    return bool(RAW_ID_PATTERN.match(session_id.strip()))


def sign_session_id(raw_id: str) -> str:
    """
    Generate an HMAC-SHA256 signature for a session UUID.
    Returns: <raw_id>.<32_char_hex_signature>
    """
    clean_id = raw_id.strip()
    signature = hmac.new(SESSION_SECRET_BYTES, clean_id.encode("utf-8"), hashlib.sha256).hexdigest()[:32]
    return f"{clean_id}.{signature}"


def generate_server_session() -> Dict[str, Any]:
    """
    Mint a fresh, cryptographically unguessable, server-signed guest session identity.
    """
    raw_id = str(uuid.uuid4())
    token = sign_session_id(raw_id)
    now = time.time()
    return {
        "session_token": token,
        "session_id": raw_id,
        "created_at": now,
        "expires_in": 7200  # 2 hours
    }


def verify_session_token(token_or_id: Optional[str], strict: Optional[bool] = None) -> Tuple[bool, Optional[str]]:
    """
    Verify a session token or ID.
    If signed (<raw_id>.<sig>): validates HMAC-SHA256 signature against server secret.
    If unsigned:
      - In strict mode (production default): rejected as untrusted client session!
      - In non-strict mode (testing): accepted if conforms to valid raw slug pattern.
    Returns: (is_valid, canonical_raw_id)
    """
    if not token_or_id or not isinstance(token_or_id, str):
        return False, None

    clean = token_or_id.strip()
    if not TOKEN_PATTERN.match(clean):
        return False, None

    if strict is None:
        strict = DEFAULT_STRICT

    if "." in clean:
        parts = clean.split(".", 1)
        raw_id, sig = parts[0], parts[1]
        if not RAW_ID_PATTERN.match(raw_id):
            return False, None

        expected_sig = hmac.new(SESSION_SECRET_BYTES, raw_id.encode("utf-8"), hashlib.sha256).hexdigest()[:32]
        if hmac.compare_digest(expected_sig, sig):
            return True, raw_id
        # Signature mismatch -> Tampered session ID!
        return False, None

    # Unsigned token
    if strict:
        # In strict mode, client-generated unsigned session IDs are untrusted and rejected
        return False, None

    if RAW_ID_PATTERN.match(clean):
        return True, clean

    return False, None


def resolve_canonical_session_id(token_or_id: Optional[str], strict: Optional[bool] = None) -> str:
    """
    Resolve and verify a session token into its canonical server-validated raw ID.
    Raises ValueError on invalid, unsigned (in strict mode), or tampered session identities.
    """
    valid, canonical_id = verify_session_token(token_or_id, strict=strict)
    if not valid or not canonical_id:
        raise ValueError(
            "Invalid or untrusted session identity. Please use a server-issued session token from /api/sessions/init."
        )
    return canonical_id
