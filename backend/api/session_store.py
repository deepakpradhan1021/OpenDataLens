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

UUID_OR_SLUG_PATTERN = re.compile(r"^[a-zA-Z0-9_-]{8,64}$")


def is_valid_session_id(session_id: Optional[str]) -> bool:
    """Validate that a session ID is non-empty and conforms to safe UUID or slug pattern."""
    if not session_id or not isinstance(session_id, str):
        return False
    return bool(UUID_OR_SLUG_PATTERN.match(session_id.strip()))


def generate_session_id() -> str:
    """Generate a cryptographically unguessable UUIDv4 session token."""
    return str(uuid.uuid4())


class SessionStore:
    def __init__(self, ttl_seconds: int = SESSION_TTL_SECONDS):
        self._lock = threading.RLock()
        self._ttl_seconds = ttl_seconds
        self._sessions: Dict[str, Dict[str, Any]] = {}
        self._jobs: Dict[str, Dict[str, Any]] = {}

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
        if not is_valid_session_id(session_id):
            raise ValueError(f"Invalid session ID format: '{session_id}'. Must be a 8-64 char UUID or slug.")

        clean_id = session_id.strip()
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
            session["metadata"] = metadata
            session["quality_analysis"] = None
            session["ml_meta"] = {}
            session["trained_models"] = {}
            session["model_evaluations"] = {}
            session["comparison_df"] = None
            now = time.time()
            session["updated_at"] = now
            session["last_accessed_at"] = now

    def get_dataset(self, session_id: str) -> Optional[pd.DataFrame]:
        with self._lock:
            if not is_valid_session_id(session_id):
                return None
            session = self._sessions.get(session_id.strip())
            if session:
                session["last_accessed_at"] = time.time()
                return session.get("dataset")
            return None

    def get_metadata(self, session_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            if not is_valid_session_id(session_id):
                return None
            session = self._sessions.get(session_id.strip())
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
            if not is_valid_session_id(session_id):
                return None
            session = self._sessions.get(session_id.strip())
            if session:
                session["last_accessed_at"] = time.time()
                return session.get("quality_analysis")
            return None

    def has_session(self, session_id: str) -> bool:
        """Check if an active session exists without initializing one."""
        with self._lock:
            if not is_valid_session_id(session_id):
                return False
            return session_id.strip() in self._sessions

    def set_ml_results(
        self,
        session_id: str,
        ml_meta: Dict[str, Any],
        trained_models: Dict[str, Any],
        model_evaluations: Dict[str, Any],
        comparison_df: pd.DataFrame
    ) -> bool:
        with self._lock:
            clean_id = session_id.strip() if session_id else ""
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
            clean_id = session_id.strip() if session_id else ""
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
            if not is_valid_session_id(session_id):
                return []
            session = self._sessions.get(session_id.strip())
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
            clean_id = session_id.strip() if session_id else ""
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
            self._jobs[job_id] = {
                "job_id": job_id,
                "session_id": session_id.strip() if session_id else "default",
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
