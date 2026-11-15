"""
OpenDataLens - Secure Sharing Engine (Hardened for Production)
Provides cryptographically unguessable, time-limited, Argon2id password-protected
analytical snapshots with sliding-window brute-force rate limiting and atomic disk writes.
"""

import os
import json
import secrets
import tempfile
import threading
import time
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError

from backend.api.session_store import store

SHARES_DIR = os.environ.get(
    "OPENDATALENS_SHARES_DIR",
    os.path.join(os.path.dirname(os.path.dirname(__file__)), "storage", "shares")
)

_hasher = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=4)
_lock = threading.RLock()

# Sliding window rate limiter: { token: [timestamp1, timestamp2, ...] }
_failed_attempts: Dict[str, List[float]] = {}
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_WINDOW_SECONDS = 900  # 15 minutes


def _ensure_dir():
    os.makedirs(SHARES_DIR, exist_ok=True)


def _check_rate_limit(token: str) -> Optional[int]:
    """
    Check if token is currently rate-limited due to excessive failed password attempts.
    Returns remaining lockout seconds if limited, else None.
    """
    now = time.time()
    with _lock:
        attempts = _failed_attempts.get(token, [])
        # Retain only attempts within the sliding window
        valid_attempts = [t for t in attempts if now - t < LOCKOUT_WINDOW_SECONDS]
        _failed_attempts[token] = valid_attempts

        if len(valid_attempts) >= MAX_FAILED_ATTEMPTS:
            oldest_relevant = valid_attempts[0]
            remaining = int(LOCKOUT_WINDOW_SECONDS - (now - oldest_relevant))
            return max(remaining, 1)
        return None


def _record_failed_attempt(token: str):
    """Record an invalid password attempt."""
    now = time.time()
    with _lock:
        if token not in _failed_attempts:
            _failed_attempts[token] = []
        _failed_attempts[token].append(now)


def _clear_failed_attempts(token: str):
    """Reset failed attempts upon successful authentication."""
    with _lock:
        _failed_attempts.pop(token, None)


def _hash_password(raw_password: str) -> str:
    """Hash password using Argon2id with cryptographic salt and memory hardness."""
    return _hasher.hash(raw_password.strip())


def _verify_password(stored_hash: str, raw_password: str) -> bool:
    """Constant-time verification of password against Argon2id hash."""
    try:
        return _hasher.verify(stored_hash, raw_password.strip())
    except (VerifyMismatchError, VerificationError):
        return False
    except Exception:
        return False


def _atomic_write_json(file_path: str, data: Dict[str, Any]):
    """Safely and atomically write JSON using temporary file and replace."""
    dir_name = os.path.dirname(file_path)
    with tempfile.NamedTemporaryFile("w", dir=dir_name, delete=False, encoding="utf-8") as tf:
        json.dump(data, tf, indent=2, default=str)
        temp_name = tf.name
    os.replace(temp_name, file_path)


def create_share_link(
    session_id: str,
    title: Optional[str] = None,
    sections: Optional[List[str]] = None,
    password: Optional[str] = None,
    expires_in_hours: Optional[int] = None
) -> Dict[str, Any]:
    """
    Generate an unguessable 256-bit URL-safe token and sanitized analytical snapshot.
    Guarantees strict exclusion of session tokens, database credentials, or server paths.
    """
    _ensure_dir()
    session = store.get_or_create_session(session_id)
    df = store.get_dataset(session_id)
    meta = session.get("metadata") or {}

    if df is None and not meta:
        raise ValueError("Cannot create share link without an active dataset or session.")

    # 256 bits (32 bytes) of cryptographic randomness (~43 URL-safe chars)
    token = secrets.token_urlsafe(32)
    created_at = datetime.now()
    expires_at = None
    if expires_in_hours and expires_in_hours > 0:
        expires_at = (created_at + timedelta(hours=expires_in_hours)).isoformat()

    pw_hash = _hash_password(password) if password and password.strip() else None

    # Allowed default sections
    if not sections:
        sections = ["summary", "quality", "cleaning", "ml", "preview"]

    # Sanitize and compile report payload
    quality = session.get("quality_analysis") or {}
    q_overview = quality.get("overview", {})
    clean_history = session.get("clean_history") or store.get_history(session_id).get("history", [])
    eval_dict = session.get("model_evaluations") or {}
    ml_meta = session.get("ml_meta") or {}

    # Build safe model leaderboard (numbers and model names only)
    leaderboard = []
    for k, ev in eval_dict.items():
        leaderboard.append({
            "model_name": str(ev.get("model_name", k)),
            "metrics": ev.get("metrics", {}),
            "fit_time": float(ev.get("fit_time", 0.0))
        })

    # Deep-sanitize clean lineage (strip any internal file paths or system ids)
    sanitized_clean_history = []
    for step in clean_history:
        sanitized_clean_history.append({
            "step": step.get("step"),
            "action": str(step.get("action", "")),
            "column": str(step.get("column", step.get("columns", "All"))),
            "timestamp": str(step.get("timestamp", ""))[:19]
        })

    # Build safe preview records (up to 20 rows max, never full raw dataset)
    preview_records = []
    columns_info = []
    if df is not None:
        preview_records = df.head(20).to_dict(orient="records")
        for col in df.columns:
            columns_info.append({
                "name": str(col),
                "type": str(df[col].dtype),
                "null_count": int(df[col].isna().sum()),
                "unique_count": int(df[col].nunique())
            })

    report_payload = {
        "dataset_name": str(meta.get("name", "Active Dataset")),
        "source": str(meta.get("source", "Uploaded File")),
        "total_rows": int(len(df)) if df is not None else int(meta.get("total_rows", 0)),
        "total_cols": int(len(df.columns)) if df is not None else int(meta.get("total_columns", 0)),
        "columns": columns_info,
        "quality_overview": {
            "completeness_score": float(q_overview.get("completeness_score", 100.0)),
            "health_score": float(q_overview.get("health_score", 100.0)),
            "duplicate_rows": int(q_overview.get("duplicate_rows", 0)),
            "missing_cells": int(q_overview.get("missing_cells", 0)),
        },
        "clean_history": sanitized_clean_history,
        "ml": {
            "problem_type": str(ml_meta.get("problem_type", "classification")),
            "target_col": str(ml_meta.get("target_col", "")) if ml_meta.get("target_col") else None,
            "feature_cols": [str(c) for c in ml_meta.get("feature_cols", [])],
            "leaderboard": leaderboard,
        },
        "preview_records": preview_records if "preview" in sections else []
    }

    share_record = {
        "token": token,
        "title": title.strip() if title and title.strip() else f"Analysis: {report_payload['dataset_name']}",
        "created_at": created_at.isoformat(),
        "expires_at": expires_at,
        "password_hash": pw_hash,
        "sections": sections,
        "report_data": report_payload
    }

    file_path = os.path.join(SHARES_DIR, f"{token}.json")
    with _lock:
        _atomic_write_json(file_path, share_record)

    return {
        "token": token,
        "share_url": f"/share/{token}",
        "title": share_record["title"],
        "created_at": share_record["created_at"],
        "expires_at": expires_at,
        "is_password_protected": bool(pw_hash),
        "sections": sections
    }


def get_shared_report(token: str, password: Optional[str] = None) -> Dict[str, Any]:
    """
    Retrieve shared report with rate-limiting, timing-safe Argon2id verification,
    and automatic expiration checks.
    """
    _ensure_dir()
    # Basic token validation (alphanumeric, underscore, dash only)
    if not token or not token.replace("-", "").replace("_", "").isalnum() or len(token) > 128:
        return {
            "status": "not_found",
            "message": "Invalid share token format."
        }

    file_path = os.path.join(SHARES_DIR, f"{token}.json")
    if not os.path.exists(file_path):
        return {
            "status": "not_found",
            "message": "Shared report link does not exist or has been revoked."
        }

    try:
        with _lock:
            with open(file_path, "r", encoding="utf-8") as f:
                record = json.load(f)
    except Exception as e:
        return {
            "status": "error",
            "message": f"Failed to load shared report: {str(e)}"
        }

    # Check expiration
    if record.get("expires_at"):
        exp_time = datetime.fromisoformat(record["expires_at"])
        if datetime.now() > exp_time:
            return {
                "status": "expired",
                "message": "This shared report link has expired."
            }

    # Check password protection
    stored_hash = record.get("password_hash")
    if stored_hash:
        # Check rate limiter first
        lockout_remaining = _check_rate_limit(token)
        if lockout_remaining:
            return {
                "status": "rate_limited",
                "message": f"Too many failed password attempts. Please wait {lockout_remaining}s before retrying.",
                "retry_after": lockout_remaining
            }

        if not password:
            return {
                "status": "password_required",
                "title": record.get("title", "Protected Report"),
                "message": "This report is password-protected. Please enter the password to view."
            }

        if not _verify_password(stored_hash, password):
            _record_failed_attempt(token)
            return {
                "status": "invalid_password",
                "message": "Incorrect password. Access denied."
            }

        # Clear failed attempts on valid login
        _clear_failed_attempts(token)

    return {
        "status": "active",
        "token": token,
        "title": record.get("title"),
        "created_at": record.get("created_at"),
        "expires_at": record.get("expires_at"),
        "sections": record.get("sections", []),
        "report_data": record.get("report_data", {})
    }


def revoke_share_link(token: str) -> bool:
    """Permanently delete and invalidate a shared snapshot."""
    _ensure_dir()
    if not token or not token.replace("-", "").replace("_", "").isalnum() or len(token) > 128:
        return False

    file_path = os.path.join(SHARES_DIR, f"{token}.json")
    with _lock:
        _clear_failed_attempts(token)
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
                return True
            except Exception:
                return False
    return False
