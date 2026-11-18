"""
OpenDataLens - Saved Projects and Analysis Lineage Store (Production Hardened)
Provides thread-safe atomic file-backed persistence for user projects,
clean lineage, model evaluation scoreboards, and strict guest-session isolation.
"""

import os
import io
import json
import uuid
import re
import tempfile
import threading
import zipfile
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple
import pandas as pd

from backend.api.session_store import store
from core.evaluator import build_comparison_table

PROJECTS_DIR = os.environ.get(
    "OPENDATALENS_PROJECTS_DIR",
    os.path.join(os.path.dirname(os.path.dirname(__file__)), "storage", "projects")
)

_lock = threading.RLock()
UUID_REGEX = re.compile(r"^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$")
MAX_BUNDLE_BYTES = 25 * 1024 * 1024       # 25 MB max compressed
MAX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024 # 50 MB max uncompressed
MAX_BUNDLE_ENTRIES = 10
MAX_COMPRESSION_RATIO = 20.0


def _ensure_dir():
    os.makedirs(PROJECTS_DIR, exist_ok=True)


def _resolve_session_ownership_id(session_id: Optional[str]) -> Tuple[Optional[str], bool]:
    """
    Resolve session identity and check if verified.
    Returns: (canonical_id, is_signed_and_valid)
    """
    if not session_id:
        return None, False
    from backend.api.security import verify_session_token
    is_valid, canonical_id = verify_session_token(session_id, strict=False)
    if "." in session_id:
        if not is_valid or not canonical_id:
            raise ValueError("Invalid or tampered session token signature.")
        return canonical_id, True
    return canonical_id or session_id.strip(), False


def _validate_project_id(project_id: str):
    """Ensure project_id is a valid UUIDv4 to prevent directory traversal attacks."""
    if not project_id or not UUID_REGEX.match(project_id.strip()):
        raise ValueError("Invalid project ID format. Must be a valid UUIDv4.")


def _atomic_write_file(file_path: str, data_bytes: bytes):
    """Safely and atomically write bytes to disk using temporary file and atomic replace with cleanup on failure."""
    dir_name = os.path.dirname(file_path)
    os.makedirs(dir_name, exist_ok=True)
    temp_name = None
    try:
        with tempfile.NamedTemporaryFile("wb", dir=dir_name, delete=False) as tf:
            tf.write(data_bytes)
            temp_name = tf.name
        os.replace(temp_name, file_path)
    except Exception:
        if temp_name and os.path.exists(temp_name):
            try:
                os.remove(temp_name)
            except Exception:
                pass
        raise


def list_projects(session_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    List saved projects scoped strictly to the calling session / workspace ID.
    Prevents cross-user project enumeration and unauthorized data leakage.
    """
    _ensure_dir()
    if not session_id:
        return []

    target_session, is_signed = _resolve_session_ownership_id(session_id)
    if not target_session:
        return []

    projects = []
    with _lock:
        for f in os.listdir(PROJECTS_DIR):
            if f.endswith(".json"):
                proj_id = f[:-5]
                if not UUID_REGEX.match(proj_id):
                    continue

                meta_path = os.path.join(PROJECTS_DIR, f)
                try:
                    with open(meta_path, "r", encoding="utf-8") as fp:
                        data = json.load(fp)

                    # Enforce session ownership filter
                    owner = data.get("owner_session_id")
                    if owner and owner != target_session:
                        continue

                    # If project was created by a verified session, require verified signature to view
                    if data.get("is_verified_session") and not is_signed:
                        continue

                    projects.append({
                        "id": data.get("id", proj_id),
                        "name": data.get("name", "Untitled Project"),
                        "description": data.get("description", ""),
                        "created_at": data.get("created_at"),
                        "updated_at": data.get("updated_at"),
                        "dataset_name": data.get("dataset_meta", {}).get("name", "Unknown Dataset"),
                        "total_rows": data.get("dataset_meta", {}).get("total_rows", 0),
                        "total_columns": data.get("dataset_meta", {}).get("total_columns", 0),
                        "clean_steps_count": len(data.get("clean_history", [])),
                        "models_trained_count": len(data.get("model_evaluations", {})),
                        "has_dataset": os.path.exists(os.path.join(PROJECTS_DIR, f"{proj_id}.parquet")) or os.path.exists(os.path.join(PROJECTS_DIR, f"{proj_id}.csv")),
                        "owner_session_id": owner,
                        "is_verified_session": data.get("is_verified_session", False)
                    })
                except Exception:
                    continue

    projects.sort(key=lambda p: p.get("updated_at") or "", reverse=True)
    return projects


def get_project(project_id: str, session_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Fetch project metadata, validating session ownership if provided."""
    _ensure_dir()
    _validate_project_id(project_id)

    meta_path = os.path.join(PROJECTS_DIR, f"{project_id}.json")
    if not os.path.exists(meta_path):
        return None

    with _lock:
        try:
            with open(meta_path, "r", encoding="utf-8") as fp:
                data = json.load(fp)
        except Exception:
            return None

    # Check ownership
    owner = data.get("owner_session_id")
    if session_id:
        target_session, is_signed = _resolve_session_ownership_id(session_id)
        if owner and owner != target_session:
            return None
        if data.get("is_verified_session") and not is_signed:
            return None

    return data


def save_project(
    session_id: str,
    name: str,
    description: str = "",
    project_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Save the current session as a project using atomic writes.
    Attaches owner_session_id to prevent cross-user modification.
    """
    _ensure_dir()
    target_session, is_signed = _resolve_session_ownership_id(session_id)
    if not target_session or len(target_session) < 8:
        raise ValueError("Valid session ID (8+ chars) required to save project.")

    session = store.get_or_create_session(session_id)
    df = store.get_dataset(session_id)
    meta = session.get("metadata") or {}

    if df is None and not meta:
        raise ValueError("Cannot save an empty workspace. Please load a dataset first.")

    now_iso = datetime.now().isoformat()
    if project_id:
        _validate_project_id(project_id)
        existing = get_project(project_id, session_id=session_id)
        if not existing:
            raise ValueError(f"Project '{project_id}' not found or unauthorized.")
        pid = project_id
    else:
        pid = str(uuid.uuid4())
        existing = None

    # Update dataset metadata with accurate dimensions
    dataset_meta = dict(meta)
    if df is not None:
        dataset_meta["total_rows"] = int(len(df))
        dataset_meta["total_columns"] = int(len(df.columns))
        dataset_meta["columns"] = list(df.columns)

    project_payload = {
        "id": pid,
        "owner_session_id": target_session,
        "is_verified_session": is_signed,
        "name": name.strip() if name and name.strip() else f"Project {pid[:8]}",
        "description": description.strip() if description else "",
        "created_at": existing.get("created_at") if existing else now_iso,
        "updated_at": now_iso,
        "dataset_meta": dataset_meta,
        "clean_history": session.get("clean_history") or store.get_history(session_id).get("history", []),
        "quality_analysis": session.get("quality_analysis"),
        "ml_meta": session.get("ml_meta", {}),
        "model_evaluations": session.get("model_evaluations", {}),
        "ai_history": session.get("ai_history", [])
    }

    # Atomic write JSON
    json_bytes = json.dumps(project_payload, indent=2, default=str).encode("utf-8")
    meta_path = os.path.join(PROJECTS_DIR, f"{pid}.json")
    with _lock:
        _atomic_write_file(meta_path, json_bytes)

        # Atomic write DataFrame if present
        if df is not None:
            parquet_path = os.path.join(PROJECTS_DIR, f"{pid}.parquet")
            try:
                buf = io.BytesIO()
                df.to_parquet(buf, index=False)
                _atomic_write_file(parquet_path, buf.getvalue())
            except Exception:
                csv_path = os.path.join(PROJECTS_DIR, f"{pid}.csv")
                csv_bytes = df.to_csv(index=False).encode("utf-8")
                _atomic_write_file(csv_path, csv_bytes)

    return {
        "id": pid,
        "name": project_payload["name"],
        "description": project_payload["description"],
        "created_at": project_payload["created_at"],
        "updated_at": project_payload["updated_at"],
        "dataset_name": dataset_meta.get("name", "Dataset"),
        "total_rows": dataset_meta.get("total_rows", 0),
        "total_columns": dataset_meta.get("total_columns", 0),
        "clean_steps_count": len(project_payload["clean_history"]),
        "models_trained_count": len(project_payload["model_evaluations"]),
        "owner_session_id": session_id
    }


def load_project(project_id: str, session_id: str) -> Dict[str, Any]:
    """
    Restore a saved project into an active workspace session after ownership check.
    """
    _ensure_dir()
    _validate_project_id(project_id)
    if not session_id or len(session_id) < 8:
        raise ValueError("Valid target session ID (8+ chars) required to load project.")

    payload = get_project(project_id, session_id=session_id)
    if not payload:
        raise ValueError(f"Project '{project_id}' not found or access denied.")

    session = store.get_or_create_session(session_id)

    # Load dataset if available
    parquet_path = os.path.join(PROJECTS_DIR, f"{project_id}.parquet")
    csv_path = os.path.join(PROJECTS_DIR, f"{project_id}.csv")
    loaded_df = None

    with _lock:
        if os.path.exists(parquet_path):
            try:
                loaded_df = pd.read_parquet(parquet_path)
            except Exception:
                pass
        elif os.path.exists(csv_path):
            try:
                loaded_df = pd.read_csv(csv_path)
            except Exception:
                pass

    if loaded_df is not None:
        store.set_dataset(session_id, loaded_df, metadata=payload.get("dataset_meta", {}))

    # Populate session state
    session["metadata"] = payload.get("dataset_meta", {})
    session["clean_history"] = payload.get("clean_history", [])
    session["quality_analysis"] = payload.get("quality_analysis")
    session["ml_meta"] = payload.get("ml_meta", {})
    session["model_evaluations"] = payload.get("model_evaluations", {})
    session["ai_history"] = payload.get("ai_history", [])

    # Reconstruct comparison_df if evaluations exist
    evals = payload.get("model_evaluations", {})
    problem_type = session.get("ml_meta", {}).get("problem_type", "classification")
    if evals:
        try:
            comp_df = build_comparison_table(evals, problem_type=problem_type)
            session["comparison_df"] = comp_df
        except Exception:
            session["comparison_df"] = None

    return {
        "status": "restored",
        "project_id": project_id,
        "name": payload.get("name"),
        "dataset_name": payload.get("dataset_meta", {}).get("name"),
        "rows": len(loaded_df) if loaded_df is not None else 0,
        "columns": len(loaded_df.columns) if loaded_df is not None else 0,
        "clean_steps": len(payload.get("clean_history", [])),
        "models_count": len(evals)
    }


def delete_project(project_id: str, session_id: Optional[str] = None) -> bool:
    """Delete a saved project and any attached dataset files after ownership check."""
    _ensure_dir()
    _validate_project_id(project_id)

    proj = get_project(project_id, session_id=session_id)
    if not proj:
        return False

    meta_path = os.path.join(PROJECTS_DIR, f"{project_id}.json")
    parquet_path = os.path.join(PROJECTS_DIR, f"{project_id}.parquet")
    csv_path = os.path.join(PROJECTS_DIR, f"{project_id}.csv")

    deleted = False
    with _lock:
        for p in [meta_path, parquet_path, csv_path]:
            if os.path.exists(p):
                try:
                    os.remove(p)
                    deleted = True
                except Exception:
                    pass
    return deleted


def export_project_bundle(project_id: str, session_id: Optional[str] = None) -> bytes:
    """Export project metadata and dataset as a portable .odl bundle (zip)."""
    _ensure_dir()
    _validate_project_id(project_id)

    proj = get_project(project_id, session_id=session_id)
    if not proj:
        raise ValueError(f"Project '{project_id}' not found or access denied.")

    meta_path = os.path.join(PROJECTS_DIR, f"{project_id}.json")
    buffer = io.BytesIO()
    with _lock:
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.write(meta_path, arcname=f"{project_id}.json")
            parquet_path = os.path.join(PROJECTS_DIR, f"{project_id}.parquet")
            csv_path = os.path.join(PROJECTS_DIR, f"{project_id}.csv")
            if os.path.exists(parquet_path):
                zf.write(parquet_path, arcname=f"{project_id}.parquet")
            elif os.path.exists(csv_path):
                zf.write(csv_path, arcname=f"{project_id}.csv")

    buffer.seek(0)
    return buffer.getvalue()


def _read_entry_safe(zf: zipfile.ZipFile, zinfo: zipfile.ZipInfo, max_bytes: int) -> bytes:
    """Read a ZIP entry safely in chunks while actively enforcing byte bounds during extraction."""
    buf = io.BytesIO()
    total_read = 0
    with zf.open(zinfo, "r") as fp:
        while True:
            chunk = fp.read(65536)
            if not chunk:
                break
            total_read += len(chunk)
            if total_read > max_bytes:
                raise ValueError(
                    f"Decompressed file '{zinfo.filename}' exceeds maximum allowed size of {max_bytes // (1024*1024)} MB."
                )
            buf.write(chunk)
    return buf.getvalue()


def import_project_bundle(bundle_bytes: bytes, session_id: str) -> Dict[str, Any]:
    """
    Import a .odl bundle into the projects store with strict security defenses:
    - Protects against ZIP path traversal ('..', absolute paths, Windows drive colons).
    - Protects against ZIP bombs (size, ratio, and entry count limits).
    - Enforces size bounds during chunked extraction, not only declared header metadata.
    - Rejects encrypted entries, hidden files, directories, duplicate entries, and unknown extensions.
    - Strictly validates extensions (.json, .parquet, .csv) and deserializes via safe parsers only.
    - NEVER uses pickle/joblib for imported archives.
    - Reassigns ownership to importing guest session.
    """
    _ensure_dir()
    target_session, is_signed = _resolve_session_ownership_id(session_id)
    if not target_session or len(target_session) < 8:
        raise ValueError("Valid session ID (8+ chars) required to import project bundle.")

    if len(bundle_bytes) > MAX_BUNDLE_BYTES:
        raise ValueError(f"Project bundle exceeds maximum allowed compressed size of {MAX_BUNDLE_BYTES // (1024*1024)} MB.")

    buffer = io.BytesIO(bundle_bytes)
    try:
        zf = zipfile.ZipFile(buffer, "r")
    except Exception as e:
        raise ValueError(f"Invalid or corrupted ZIP archive: {str(e)}")

    infolist = zf.infolist()
    if len(infolist) == 0:
        raise ValueError("Invalid project bundle: Empty archive.")
    if len(infolist) > MAX_BUNDLE_ENTRIES:
        raise ValueError(f"Archive exceeds maximum allowed entry count ({MAX_BUNDLE_ENTRIES}).")

    # Header-level pre-check
    total_declared_uncompressed = sum(z.file_size for z in infolist)
    if total_declared_uncompressed > MAX_UNCOMPRESSED_BYTES:
        raise ValueError(f"Archive decompression bomb detected. Declared size exceeds {MAX_UNCOMPRESSED_BYTES // (1024*1024)} MB.")

    allowed_extensions = {".json", ".parquet", ".csv"}
    seen_names = set()
    json_entry = None
    data_entry = None

    for zinfo in infolist:
        name = zinfo.filename

        # Reject directories
        if zinfo.is_dir() or name.endswith("/"):
            raise ValueError(f"Directory entry '{name}' is forbidden in project bundle.")

        # Reject encrypted entries
        if zinfo.flag_bits & 0x1:
            raise ValueError(f"Encrypted entry '{name}' is forbidden in project bundle.")

        # Reject path traversal, absolute paths, hidden files, and drive letters
        if "/" in name or "\\" in name or ".." in name or ":" in name or name.startswith("."):
            raise ValueError(f"Path traversal or invalid path detected in archive entry '{name}'.")

        # Reject duplicate filenames
        lower_name = name.lower()
        if lower_name in seen_names:
            raise ValueError(f"Duplicate file entry '{name}' detected in project bundle.")
        seen_names.add(lower_name)

        # Check suspicious compression ratio (e.g. 42.zip decompression bomb)
        if zinfo.compress_size > 0:
            ratio = zinfo.file_size / zinfo.compress_size
            if ratio > MAX_COMPRESSION_RATIO and zinfo.file_size > 1024 * 1024:
                raise ValueError(f"Suspicious compression ratio ({ratio:.1f}:1) detected for '{name}'.")

        ext = os.path.splitext(name)[1].lower()
        if ext not in allowed_extensions:
            raise ValueError(f"Forbidden file extension in project bundle: '{ext}'. Allowed: {allowed_extensions}")

        if ext == ".json":
            if json_entry is not None:
                raise ValueError("Multiple metadata JSON files found in project bundle.")
            json_entry = zinfo
        elif ext in {".parquet", ".csv"}:
            if data_entry is not None:
                raise ValueError("Multiple dataset files found in project bundle.")
            data_entry = zinfo

    if not json_entry:
        raise ValueError("Invalid project bundle: No metadata JSON found in archive root.")

    # Parse JSON safely with size limit enforcement during chunk reading
    try:
        raw_json_bytes = _read_entry_safe(zf, json_entry, max_bytes=10 * 1024 * 1024)
        raw_json = raw_json_bytes.decode("utf-8")
        meta_content = json.loads(raw_json)
        if not isinstance(meta_content, dict):
            raise ValueError("Project metadata must be a JSON object.")
    except Exception as e:
        raise ValueError(f"Corrupted or invalid metadata JSON: {str(e)}")

    new_pid = str(uuid.uuid4())
    meta_content["id"] = new_pid
    meta_content["owner_session_id"] = target_session
    meta_content["is_verified_session"] = is_signed
    meta_content["name"] = f"{meta_content.get('name', 'Imported Project')} (Imported)"
    meta_content["updated_at"] = datetime.now().isoformat()

    with _lock:
        meta_bytes = json.dumps(meta_content, indent=2, default=str).encode("utf-8")
        out_json = os.path.join(PROJECTS_DIR, f"{new_pid}.json")
        _atomic_write_file(out_json, meta_bytes)

        # Validate and write dataset safely
        if data_entry:
            remaining_bytes = MAX_UNCOMPRESSED_BYTES - len(raw_json_bytes)
            try:
                data_bytes = _read_entry_safe(zf, data_entry, max_bytes=remaining_bytes)
            except Exception as e:
                if os.path.exists(out_json):
                    os.remove(out_json)
                raise ValueError(str(e))

            ext = os.path.splitext(data_entry.filename)[1].lower()

            # Verify dataset opens with safe parser (never pickle/joblib)
            try:
                if ext == ".parquet":
                    pd.read_parquet(io.BytesIO(data_bytes))
                elif ext == ".csv":
                    pd.read_csv(io.BytesIO(data_bytes))
            except Exception as e:
                # Rollback metadata file
                if os.path.exists(out_json):
                    os.remove(out_json)
                raise ValueError(f"Corrupted dataset snapshot in bundle: {str(e)}")

            out_data = os.path.join(PROJECTS_DIR, f"{new_pid}{ext}")
            _atomic_write_file(out_data, data_bytes)

    return {
        "id": new_pid,
        "name": meta_content["name"],
        "dataset_name": meta_content.get("dataset_meta", {}).get("name", "Dataset"),
        "created_at": meta_content.get("created_at"),
        "updated_at": meta_content.get("updated_at"),
        "owner_session_id": session_id
    }
