"""
In-Memory Session and Background Job Store for OpenDataLens FastAPI Service.
Maintains isolated stateful datasets, evaluations, trained models, experiment history,
and asynchronous job progress with cryptographically secure session IDs and TTL expiration.
"""

import time
import re
import uuid
import secrets
import logging
import threading
from typing import Dict, Any, Optional, List
import pandas as pd

logger = logging.getLogger(__name__)

# Session TTL: 2 hours of inactivity before cleanup
SESSION_TTL_SECONDS = 7200
# Job TTL: 1 hour after completion/failure before cleanup
JOB_TTL_SECONDS = 3600
# Maximum undo history snapshots per session (guards 512MB RAM budget)
MAX_HISTORY_SNAPSHOTS = 8

UUID_OR_SLUG_PATTERN = re.compile(r"^[a-zA-Z0-9_-]{8,64}$")
TOKEN_PATTERN = re.compile(r"^[a-zA-Z0-9_.-]{8,128}$")


def is_valid_session_id(session_id: Optional[str]) -> bool:
    """Validate that a session ID is non-empty and conforms to safe UUID, token or slug pattern."""
    if not session_id or not isinstance(session_id, str):
        return False
    clean = session_id.strip()
    return bool(UUID_OR_SLUG_PATTERN.match(clean) or TOKEN_PATTERN.match(clean))


def generate_session_id() -> str:
    """Generate a cryptographically unguessable UUIDv4 session token."""
    return str(uuid.uuid4())


class SessionStore:
    def __init__(self, ttl_seconds: int = SESSION_TTL_SECONDS):
        self._lock = threading.RLock()
        self._ttl_seconds = ttl_seconds
        self._sessions: Dict[str, Dict[str, Any]] = {}
        self._jobs: Dict[str, Dict[str, Any]] = {}

    def _resolve_session_key(self, session_id: str) -> str:
        """Resolve canonical session key, verifying signature if signed."""
        if not is_valid_session_id(session_id):
            raise ValueError(f"Invalid session ID format: '{session_id}'. Must be a 8-128 char UUID or signed token.")

        from backend.api.security import verify_session_token
        is_valid, canonical_id = verify_session_token(session_id, strict=False)
        if not is_valid or not canonical_id:
            if "." in session_id:
                raise ValueError("Invalid or tampered session token signature.")
            return session_id.strip()
        return canonical_id

    def _evict_expired_unlocked(self) -> int:
        """Internal sweep to clean up inactive sessions and old jobs (caller must hold lock)."""
        now = time.time()
        expired_sessions = [
            sid for sid, data in self._sessions.items()
            if (now - data.get("last_accessed_at", data.get("updated_at", 0))) > self._ttl_seconds
        ]
        for sid in expired_sessions:
            del self._sessions[sid]

        expired_jobs = [
            jid for jid, job in self._jobs.items()
            if job.get("completed_at") and (now - job["completed_at"]) > JOB_TTL_SECONDS
        ]
        for jid in expired_jobs:
            del self._jobs[jid]

        if expired_sessions or expired_jobs:
            logger.info(
                f"[SessionStore] Evicted {len(expired_sessions)} expired sessions "
                f"and {len(expired_jobs)} expired jobs."
            )
        return len(expired_sessions)

    def evict_expired(self) -> int:
        """Public sweep for periodic cleanup."""
        with self._lock:
            return self._evict_expired_unlocked()

    def get_active_session_count(self) -> int:
        """Return the number of currently active in-memory sessions."""
        with self._lock:
            self._evict_expired_unlocked()
            return len(self._sessions)

    def get_or_create_session(self, session_id: str) -> Dict[str, Any]:
        """
        Retrieve or initialize a workspace session.
        Validates session ID format and updates last accessed timestamp.
        """
        clean_id = self._resolve_session_key(session_id)
        now = time.time()

        with self._lock:
            self._evict_expired_unlocked()
            if clean_id not in self._sessions:
                self._sessions[clean_id] = {
                    "session_id": clean_id,
                    "dataset": None,
                    "metadata": None,
                    "quality_analysis": None,
                    "ml_meta": {},
                    "trained_models": {},
                    "model_evaluations": {},
                    "comparison_df": None,
                    "experiments": [],
                    "history": [],
                    "future": [],
                    "named_checkpoints": {},
                    "last_action": "Initial State",
                    "created_at": now,
                    "updated_at": now,
                    "last_accessed_at": now
                }
            else:
                self._sessions[clean_id]["last_accessed_at"] = now
            return self._sessions[clean_id]

    def set_dataset(self, session_id: str, df: pd.DataFrame, metadata: Dict[str, Any]) -> None:
        """Store dataset and metadata in the session, resetting downstream model artifacts."""
        with self._lock:
            session = self.get_or_create_session(session_id)
            session["dataset"] = df
            session["metadata"] = dict(metadata)
            session["quality_analysis"] = None
            session["ml_meta"] = {}
            session["trained_models"] = {}
            session["model_evaluations"] = {}
            session["comparison_df"] = None
            session["history"] = []
            session["future"] = []
            session["last_action"] = f"Mounted {metadata.get('name', 'dataset')}"
            now = time.time()
            session["updated_at"] = now
            session["last_accessed_at"] = now

    def push_checkpoint(self, session_id: str, new_df: pd.DataFrame, action: str) -> Dict[str, Any]:
        """
        Record the current state in the undo history stack and apply new transformed DataFrame.
        Enforces MAX_HISTORY_SNAPSHOTS cap to conserve in-memory RAM.
        """
        with self._lock:
            session = self.get_or_create_session(session_id)
            current_df = session.get("dataset")
            current_meta = session.get("metadata") or {}

            if current_df is not None:
                # Save snapshot of previous state
                session["history"].append({
                    "df": current_df.copy(),
                    "metadata": dict(current_meta),
                    "action": session.get("last_action", "Transformed data"),
                    "timestamp": time.time(),
                    "rows": int(current_df.shape[0]),
                    "cols": int(current_df.shape[1])
                })
                # Trim history stack to prevent memory bloat
                if len(session["history"]) > MAX_HISTORY_SNAPSHOTS:
                    session["history"].pop(0)

            session["future"] = []  # Clear redo stack on new action
            session["dataset"] = new_df
            updated_meta = dict(current_meta)
            updated_meta["rows"] = int(new_df.shape[0])
            updated_meta["cols"] = int(new_df.shape[1])
            session["metadata"] = updated_meta
            session["last_action"] = action
            session["quality_analysis"] = None  # Invalidate cached quality

            now = time.time()
            session["updated_at"] = now
            session["last_accessed_at"] = now

            return {
                "action": action,
                "rows": int(new_df.shape[0]),
                "cols": int(new_df.shape[1]),
                "can_undo": len(session["history"]) > 0,
                "can_redo": False
            }

    def undo_checkpoint(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Undo the last data transformation and revert to previous DataFrame snapshot."""
        with self._lock:
            if not self.has_session(session_id):
                return None
            session = self.get_or_create_session(session_id)
            if not session["history"]:
                return None

            current_df = session.get("dataset")
            current_meta = session.get("metadata") or {}
            # Push current to redo future stack
            if current_df is not None:
                session["future"].append({
                    "df": current_df.copy(),
                    "metadata": dict(current_meta),
                    "action": session.get("last_action", "Current state"),
                    "timestamp": time.time(),
                    "rows": int(current_df.shape[0]),
                    "cols": int(current_df.shape[1])
                })

            # Pop previous snapshot
            prev = session["history"].pop()
            session["dataset"] = prev["df"]
            session["metadata"] = prev["metadata"]
            session["last_action"] = f"Reverted to: {prev['action']}"
            session["quality_analysis"] = None

            now = time.time()
            session["updated_at"] = now
            session["last_accessed_at"] = now

            return {
                "action": session["last_action"],
                "rows": int(prev["df"].shape[0]),
                "cols": int(prev["df"].shape[1]),
                "can_undo": len(session["history"]) > 0,
                "can_redo": len(session["future"]) > 0
            }

    def redo_checkpoint(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Redo previously undone data transformation."""
        with self._lock:
            if not self.has_session(session_id):
                return None
            session = self.get_or_create_session(session_id)
            if not session["future"]:
                return None

            current_df = session.get("dataset")
            current_meta = session.get("metadata") or {}
            if current_df is not None:
                session["history"].append({
                    "df": current_df.copy(),
                    "metadata": dict(current_meta),
                    "action": session.get("last_action", "Current state"),
                    "timestamp": time.time(),
                    "rows": int(current_df.shape[0]),
                    "cols": int(current_df.shape[1])
                })

            nxt = session["future"].pop()
            session["dataset"] = nxt["df"]
            session["metadata"] = nxt["metadata"]
            session["last_action"] = f"Restored: {nxt['action']}"
            session["quality_analysis"] = None

            now = time.time()
            session["updated_at"] = now
            session["last_accessed_at"] = now

            return {
                "action": session["last_action"],
                "rows": int(nxt["df"].shape[0]),
                "cols": int(nxt["df"].shape[1]),
                "can_undo": len(session["history"]) > 0,
                "can_redo": len(session["future"]) > 0
            }

    def get_history(self, session_id: str) -> Dict[str, Any]:
        """Return history timeline items and undo/redo capabilities."""
        with self._lock:
            if not self.has_session(session_id):
                return {"history": [], "can_undo": False, "can_redo": False, "last_action": None}
            session = self.get_or_create_session(session_id)
            items = [
                {
                    "step": idx + 1,
                    "action": h["action"],
                    "timestamp": h["timestamp"],
                    "rows": h["rows"],
                    "cols": h["cols"]
                }
                for idx, h in enumerate(session.get("history", []))
            ]
            return {
                "history": items,
                "can_undo": len(session.get("history", [])) > 0,
                "can_redo": len(session.get("future", [])) > 0,
                "last_action": session.get("last_action")
            }

    def create_named_checkpoint(self, session_id: str, name: str) -> Dict[str, Any]:
        """Save a persistent named snapshot of the current DataFrame state."""
        with self._lock:
            session = self.get_or_create_session(session_id)
            df = session.get("dataset")
            if df is None:
                raise ValueError("No active dataset in session to checkpoint.")

            clean_name = name.strip()
            if not clean_name or len(clean_name) > 60:
                raise ValueError("Checkpoint name must be between 1 and 60 characters.")

            if "named_checkpoints" not in session:
                session["named_checkpoints"] = {}

            # Limit to 5 named checkpoints per session to guard memory
            if len(session["named_checkpoints"]) >= 5 and clean_name not in session["named_checkpoints"]:
                oldest_key = min(session["named_checkpoints"].keys(), key=lambda k: session["named_checkpoints"][k]["timestamp"])
                del session["named_checkpoints"][oldest_key]

            meta = session.get("metadata") or {}
            now = time.time()
            session["named_checkpoints"][clean_name] = {
                "name": clean_name,
                "df": df.copy(),
                "metadata": dict(meta),
                "timestamp": now,
                "rows": int(df.shape[0]),
                "cols": int(df.shape[1]),
                "last_action": session.get("last_action", "Saved checkpoint")
            }
            session["last_accessed_at"] = now
            return {
                "name": clean_name,
                "rows": int(df.shape[0]),
                "cols": int(df.shape[1]),
                "timestamp": now,
                "last_action": session.get("last_action")
            }

    def restore_named_checkpoint(self, session_id: str, name: str) -> Dict[str, Any]:
        """Restore dataset to a previously saved named checkpoint."""
        with self._lock:
            session = self.get_or_create_session(session_id)
            cps = session.get("named_checkpoints", {})
            if name not in cps:
                raise ValueError(f"Named checkpoint '{name}' not found.")

            cp = cps[name]
            current_df = session.get("dataset")
            current_meta = session.get("metadata") or {}

            # Push current state to undo history before restoring
            if current_df is not None:
                session["history"].append({
                    "df": current_df.copy(),
                    "metadata": dict(current_meta),
                    "action": session.get("last_action", "Pre-restore state"),
                    "timestamp": time.time(),
                    "rows": int(current_df.shape[0]),
                    "cols": int(current_df.shape[1])
                })
                if len(session["history"]) > MAX_HISTORY_SNAPSHOTS:
                    session["history"].pop(0)

            session["future"] = []
            session["dataset"] = cp["df"].copy()
            session["metadata"] = dict(cp["metadata"])
            session["last_action"] = f"Restored checkpoint: {name}"
            session["quality_analysis"] = None

            now = time.time()
            session["updated_at"] = now
            session["last_accessed_at"] = now

            return {
                "action": session["last_action"],
                "name": name,
                "rows": int(cp["df"].shape[0]),
                "cols": int(cp["df"].shape[1]),
                "can_undo": len(session["history"]) > 0,
                "can_redo": False
            }

    def list_named_checkpoints(self, session_id: str) -> List[Dict[str, Any]]:
        """Return list of all saved named checkpoints for the session."""
        with self._lock:
            if not self.has_session(session_id):
                return []
            session = self.get_or_create_session(session_id)
            cps = session.get("named_checkpoints", {})
            return [
                {
                    "name": cp["name"],
                    "timestamp": cp["timestamp"],
                    "rows": cp["rows"],
                    "cols": cp["cols"],
                    "last_action": cp.get("last_action")
                }
                for cp in sorted(cps.values(), key=lambda x: x["timestamp"], reverse=True)
            ]

    def delete_named_checkpoint(self, session_id: str, name: str) -> bool:
        """Delete a named checkpoint from the session."""
        with self._lock:
            if not self.has_session(session_id):
                return False
            session = self.get_or_create_session(session_id)
            cps = session.get("named_checkpoints", {})
            if name in cps:
                del cps[name]
                return True
            return False

    def get_dataset(self, session_id: str) -> Optional[pd.DataFrame]:
        with self._lock:
            try:
                clean_id = self._resolve_session_key(session_id)
            except ValueError:
                return None
            session = self._sessions.get(clean_id)
            if session:
                session["last_accessed_at"] = time.time()
                return session.get("dataset")
            return None

    def get_metadata(self, session_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            try:
                clean_id = self._resolve_session_key(session_id)
            except ValueError:
                return None
            session = self._sessions.get(clean_id)
            if session:
                session["last_accessed_at"] = time.time()
                return session.get("metadata")
            return None

    def set_quality_analysis(self, session_id: str, analysis: Dict[str, Any]) -> None:
        with self._lock:
            session = self.get_or_create_session(session_id)
            session["quality_analysis"] = analysis
            now = time.time()
            session["updated_at"] = now
            session["last_accessed_at"] = now

    def get_quality_analysis(self, session_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            try:
                clean_id = self._resolve_session_key(session_id)
            except ValueError:
                return None
            session = self._sessions.get(clean_id)
            if session:
                session["last_accessed_at"] = time.time()
                return session.get("quality_analysis")
            return None

    def has_session(self, session_id: str) -> bool:
        """Check if an active session exists without initializing one."""
        with self._lock:
            try:
                clean_id = self._resolve_session_key(session_id)
            except ValueError:
                return False
            return clean_id in self._sessions

    def set_ml_results(
        self,
        session_id: str,
        ml_meta: Dict[str, Any],
        trained_models: Dict[str, Any],
        model_evaluations: Dict[str, Any],
        comparison_df: pd.DataFrame
    ) -> bool:
        with self._lock:
            try:
                clean_id = self._resolve_session_key(session_id)
            except ValueError:
                return False
            if clean_id not in self._sessions:
                logger.warning(
                    f"[SessionStore] Prevented writing ML results to cleared/expired session: {clean_id}"
                )
                return False
            session = self._sessions[clean_id]
            session["ml_meta"] = ml_meta
            session["trained_models"] = trained_models
            session["model_evaluations"] = model_evaluations
            session["comparison_df"] = comparison_df
            now = time.time()
            session["updated_at"] = now
            session["last_accessed_at"] = now
            return True

    def record_experiment(self, session_id: str, experiment_data: Dict[str, Any]) -> bool:
        """Append an experiment run record to the session history if session still exists."""
        with self._lock:
            try:
                clean_id = self._resolve_session_key(session_id)
            except ValueError:
                return False
            if clean_id not in self._sessions:
                return False
            session = self._sessions[clean_id]
            if "experiments" not in session:
                session["experiments"] = []
            session["experiments"].append(experiment_data)
            now = time.time()
            session["updated_at"] = now
            session["last_accessed_at"] = now
            return True

    def get_experiments(self, session_id: str) -> List[Dict[str, Any]]:
        with self._lock:
            try:
                clean_id = self._resolve_session_key(session_id)
            except ValueError:
                return []
            session = self._sessions.get(clean_id)
            if session:
                session["last_accessed_at"] = time.time()
                return list(session.get("experiments", []))
            return []

    def clear_session(self, session_id: str) -> bool:
        """
        Clear all workspace data and artifacts for the given session ID,
        and cancel any pending or actively executing background training jobs.
        """
        with self._lock:
            try:
                clean_id = self._resolve_session_key(session_id)
            except ValueError:
                return False
            now = time.time()
            cancelled_jobs_count = 0

            # Invalidate and cancel all associated running/pending jobs
            for jid, job in self._jobs.items():
                if job.get("session_id") == clean_id and job.get("status") in ["pending", "running"]:
                    job["status"] = "cancelled"
                    job["error"] = "Workspace session was cleared by user."
                    job["completed_at"] = now
                    cancelled_jobs_count += 1

            if clean_id in self._sessions:
                del self._sessions[clean_id]
                logger.info(
                    f"[SessionStore] Cleared workspace session: {clean_id} "
                    f"(cancelled {cancelled_jobs_count} running jobs)"
                )
                return True
            return False

    def create_job(self, job_id: str, session_id: str, total_models: int) -> None:
        with self._lock:
            try:
                clean_id = self._resolve_session_key(session_id)
            except ValueError:
                clean_id = session_id.strip() if session_id else "default"
            self._jobs[job_id] = {
                "job_id": job_id,
                "session_id": clean_id,
                "status": "pending",
                "progress": 0,
                "total_models": total_models,
                "current_model": "",
                "error": None,
                "created_at": time.time(),
                "completed_at": None
            }

    def update_job(
        self,
        job_id: str,
        status: Optional[str] = None,
        progress: Optional[int] = None,
        current_model: Optional[str] = None,
        error: Optional[str] = None
    ) -> None:
        with self._lock:
            if job_id in self._jobs:
                if status is not None:
                    self._jobs[job_id]["status"] = status
                    if status in ["completed", "failed"]:
                        self._jobs[job_id]["completed_at"] = time.time()
                if progress is not None:
                    self._jobs[job_id]["progress"] = progress
                if current_model is not None:
                    self._jobs[job_id]["current_model"] = current_model
                if error is not None:
                    self._jobs[job_id]["error"] = error

    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            return self._jobs.get(job_id)


# Global singleton instance
store = SessionStore()
