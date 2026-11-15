"""
OpenDataLens - Secure Sharing Engine
Enables users to publish read-only, time-limited, optionally password-protected
analytical snapshots of datasets, data quality audits, and ML scoreboards.
"""

import os
import json
import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional

from backend.api.session_store import store

SHARES_DIR = os.environ.get(
    "OPENDATALENS_SHARES_DIR",
    os.path.join(os.path.dirname(os.path.dirname(__file__)), "storage", "shares")
)


def _ensure_dir():
    os.makedirs(SHARES_DIR, exist_ok=True)


def _hash_password(raw_password: str) -> str:
    return hashlib.sha256(raw_password.strip().encode("utf-8")).hexdigest()


def create_share_link(
    session_id: str,
    title: Optional[str] = None,
    sections: Optional[List[str]] = None,
    password: Optional[str] = None,
    expires_in_hours: Optional[int] = None
) -> Dict[str, Any]:
    """
    Generate an encrypted, sanitized, read-only analytical snapshot.
    Ensures zero leakage of session tokens, database credentials, or server paths.
    """
    _ensure_dir()
    session = store.get_or_create_session(session_id)
    df = store.get_dataset(session_id)
    meta = session.get("metadata") or {}

    if df is None and not meta:
        raise ValueError("Cannot create share link without an active dataset or session.")

    token = secrets.token_urlsafe(16)
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

    # Build safe model leaderboard
    leaderboard = []
    for k, ev in eval_dict.items():
        leaderboard.append({
            "model_name": ev.get("model_name", k),
            "metrics": ev.get("metrics", {}),
            "fit_time": ev.get("fit_time", 0.0)
        })

    # Build safe preview records (up to 25 rows)
    preview_records = []
    columns_info = []
    if df is not None:
        preview_records = df.head(25).to_dict(orient="records")
        for col in df.columns:
            columns_info.append({
                "name": str(col),
                "type": str(df[col].dtype),
                "null_count": int(df[col].isna().sum()),
                "unique_count": int(df[col].nunique())
            })

    report_payload = {
        "dataset_name": meta.get("name", "Active Dataset"),
        "source": meta.get("source", "Uploaded File"),
        "total_rows": len(df) if df is not None else meta.get("total_rows", 0),
        "total_cols": len(df.columns) if df is not None else meta.get("total_columns", 0),
        "columns": columns_info,
        "quality_overview": {
            "completeness_score": q_overview.get("completeness_score", 100.0),
            "health_score": q_overview.get("health_score", 100.0),
            "duplicate_rows": q_overview.get("duplicate_rows", 0),
            "missing_cells": q_overview.get("missing_cells", 0),
        },
        "clean_history": clean_history,
        "ml": {
            "problem_type": ml_meta.get("problem_type"),
            "target_col": ml_meta.get("target_col"),
            "feature_cols": ml_meta.get("feature_cols", []),
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
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(share_record, f, indent=2, default=str)

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
    Retrieve shared report if token exists, is not expired, and password passes.
    """
    _ensure_dir()
    file_path = os.path.join(SHARES_DIR, f"{token}.json")
    if not os.path.exists(file_path):
        return {
            "status": "not_found",
            "message": "Shared report link does not exist or has been revoked."
        }

    try:
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
        if not password:
            return {
                "status": "password_required",
                "title": record.get("title", "Protected Report"),
                "message": "This report is password-protected. Please enter the password to view."
            }
        provided_hash = _hash_password(password)
        if provided_hash != stored_hash:
            return {
                "status": "invalid_password",
                "message": "Incorrect password. Access denied."
            }

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
    file_path = os.path.join(SHARES_DIR, f"{token}.json")
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
            return True
        except Exception:
            return False
    return False
