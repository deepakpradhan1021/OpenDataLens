"""
OpenDataLens - Saved Projects and Analysis Lineage Store
Provides lightweight, reliable file-backed persistence for user projects,
clean lineage, model evaluation scoreboards, and conversational context.
"""

import os
import io
import json
import uuid
import zipfile
from datetime import datetime
from typing import Dict, Any, List, Optional
import pandas as pd

from backend.api.session_store import store
from core.evaluator import build_comparison_table

PROJECTS_DIR = os.environ.get(
    "OPENDATALENS_PROJECTS_DIR",
    os.path.join(os.path.dirname(os.path.dirname(__file__)), "storage", "projects")
)


def _ensure_dir():
    os.makedirs(PROJECTS_DIR, exist_ok=True)


def list_projects() -> List[Dict[str, Any]]:
    """List all saved projects sorted by updated_at descending."""
    _ensure_dir()
    projects = []
    for f in os.listdir(PROJECTS_DIR):
        if f.endswith(".json"):
            proj_id = f[:-5]
            meta_path = os.path.join(PROJECTS_DIR, f)
            try:
                with open(meta_path, "r", encoding="utf-8") as fp:
                    data = json.load(fp)
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
                    "has_dataset": os.path.exists(os.path.join(PROJECTS_DIR, f"{proj_id}.parquet"))
                })
            except Exception:
                continue

    projects.sort(key=lambda p: p.get("updated_at") or "", reverse=True)
    return projects


def get_project(project_id: str) -> Optional[Dict[str, Any]]:
    """Fetch full project metadata."""
    _ensure_dir()
    meta_path = os.path.join(PROJECTS_DIR, f"{project_id}.json")
    if not os.path.exists(meta_path):
        return None
    with open(meta_path, "r", encoding="utf-8") as fp:
        return json.load(fp)


def save_project(
    session_id: str,
    name: str,
    description: str = "",
    project_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Save the current session as a project.
    If project_id is provided, updates existing project; otherwise generates new UUID.
    """
    _ensure_dir()
    session = store.get_or_create_session(session_id)
    df = store.get_dataset(session_id)
    meta = session.get("metadata") or {}

    if df is None and not meta:
        raise ValueError("Cannot save an empty workspace. Please load a dataset first.")

    now_iso = datetime.now().isoformat()
    pid = project_id if project_id else str(uuid.uuid4())
    existing = get_project(pid) if project_id else None

    # Update dataset metadata with accurate dimensions
    dataset_meta = dict(meta)
    if df is not None:
        dataset_meta["total_rows"] = int(len(df))
        dataset_meta["total_columns"] = int(len(df.columns))
        dataset_meta["columns"] = list(df.columns)

    project_payload = {
        "id": pid,
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

    # Save metadata JSON
    meta_path = os.path.join(PROJECTS_DIR, f"{pid}.json")
    with open(meta_path, "w", encoding="utf-8") as fp:
        json.dump(project_payload, fp, indent=2, default=str)

    # Save DataFrame if present
    if df is not None:
        parquet_path = os.path.join(PROJECTS_DIR, f"{pid}.parquet")
        try:
            df.to_parquet(parquet_path, index=False)
        except Exception:
            # Fallback to CSV if parquet engine isn't available
            csv_path = os.path.join(PROJECTS_DIR, f"{pid}.csv")
            df.to_csv(csv_path, index=False)

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
        "models_trained_count": len(project_payload["model_evaluations"])
    }


def load_project(project_id: str, session_id: str) -> Dict[str, Any]:
    """
    Restore a saved project into an active workspace session.
    """
    _ensure_dir()
    meta_path = os.path.join(PROJECTS_DIR, f"{project_id}.json")
    if not os.path.exists(meta_path):
        raise ValueError(f"Project '{project_id}' not found.")

    with open(meta_path, "r", encoding="utf-8") as fp:
        payload = json.load(fp)

    session = store.get_or_create_session(session_id)

    # Load dataset if available
    parquet_path = os.path.join(PROJECTS_DIR, f"{project_id}.parquet")
    csv_path = os.path.join(PROJECTS_DIR, f"{project_id}.csv")
    loaded_df = None

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


def delete_project(project_id: str) -> bool:
    """Delete a saved project and any attached dataset files."""
    _ensure_dir()
    meta_path = os.path.join(PROJECTS_DIR, f"{project_id}.json")
    parquet_path = os.path.join(PROJECTS_DIR, f"{project_id}.parquet")
    csv_path = os.path.join(PROJECTS_DIR, f"{project_id}.csv")

    deleted = False
    for p in [meta_path, parquet_path, csv_path]:
        if os.path.exists(p):
            try:
                os.remove(p)
                deleted = True
            except Exception:
                pass
    return deleted


def export_project_bundle(project_id: str) -> bytes:
    """Export project metadata and dataset as a portable .odl bundle (zip)."""
    _ensure_dir()
    meta_path = os.path.join(PROJECTS_DIR, f"{project_id}.json")
    if not os.path.exists(meta_path):
        raise ValueError(f"Project '{project_id}' not found.")

    buffer = io.BytesIO()
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


def import_project_bundle(bundle_bytes: bytes) -> Dict[str, Any]:
    """Import a .odl bundle into the projects store."""
    _ensure_dir()
    buffer = io.BytesIO(bundle_bytes)
    with zipfile.ZipFile(buffer, "r") as zf:
        json_files = [f for f in zf.namelist() if f.endswith(".json")]
        if not json_files:
            raise ValueError("Invalid project bundle: No metadata JSON found.")

        json_name = json_files[0]
        meta_content = json.loads(zf.read(json_name).decode("utf-8"))

        new_pid = str(uuid.uuid4())
        meta_content["id"] = new_pid
        meta_content["name"] = f"{meta_content.get('name', 'Imported Project')} (Imported)"
        meta_content["updated_at"] = datetime.now().isoformat()

        # Save metadata
        out_json = os.path.join(PROJECTS_DIR, f"{new_pid}.json")
        with open(out_json, "w", encoding="utf-8") as fp:
            json.dump(meta_content, fp, indent=2, default=str)

        # Check for dataset files
        for ext in [".parquet", ".csv"]:
            matching = [f for f in zf.namelist() if f.endswith(ext)]
            if matching:
                data_bytes = zf.read(matching[0])
                out_data = os.path.join(PROJECTS_DIR, f"{new_pid}{ext}")
                with open(out_data, "wb") as fp:
                    fp.write(data_bytes)
                break

    return {
        "id": new_pid,
        "name": meta_content["name"],
        "dataset_name": meta_content.get("dataset_meta", {}).get("name", "Dataset"),
        "created_at": meta_content.get("created_at"),
        "updated_at": meta_content.get("updated_at")
    }
