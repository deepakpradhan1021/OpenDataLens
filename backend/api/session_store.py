"""
In-Memory Session and Background Job Store for OpenDataLens FastAPI Service.
Maintains stateful datasets, evaluations, trained models, and asynchronous job progress.
"""

import time
import threading
from typing import Dict, Any, Optional
import pandas as pd


class SessionStore:
    def __init__(self):
        self._lock = threading.RLock()
        self._sessions: Dict[str, Dict[str, Any]] = {}
        self._jobs: Dict[str, Dict[str, Any]] = {}

    def get_or_create_session(self, session_id: str = "default") -> Dict[str, Any]:
        with self._lock:
            if session_id not in self._sessions:
                self._sessions[session_id] = {
                    "dataset": None,
                    "metadata": None,
                    "quality_analysis": None,
                    "ml_meta": {},
                    "trained_models": {},
                    "model_evaluations": {},
                    "comparison_df": None,
                    "updated_at": time.time()
                }
            return self._sessions[session_id]

    def set_dataset(self, session_id: str, df: pd.DataFrame, metadata: Dict[str, Any]) -> None:
        with self._lock:
            session = self.get_or_create_session(session_id)
            session["dataset"] = df
            session["metadata"] = metadata
            session["quality_analysis"] = None
            session["ml_meta"] = {}
            session["trained_models"] = {}
            session["model_evaluations"] = {}
            session["comparison_df"] = None
            session["updated_at"] = time.time()

    def get_dataset(self, session_id: str = "default") -> Optional[pd.DataFrame]:
        with self._lock:
            session = self._sessions.get(session_id)
            return session["dataset"] if session else None

    def get_metadata(self, session_id: str = "default") -> Optional[Dict[str, Any]]:
        with self._lock:
            session = self._sessions.get(session_id)
            return session["metadata"] if session else None

    def set_quality_analysis(self, session_id: str, analysis: Dict[str, Any]) -> None:
        with self._lock:
            session = self.get_or_create_session(session_id)
            session["quality_analysis"] = analysis
            session["updated_at"] = time.time()

    def get_quality_analysis(self, session_id: str = "default") -> Optional[Dict[str, Any]]:
        with self._lock:
            session = self._sessions.get(session_id)
            return session["quality_analysis"] if session else None

    def set_ml_results(
        self,
        session_id: str,
        ml_meta: Dict[str, Any],
        trained_models: Dict[str, Any],
        model_evaluations: Dict[str, Any],
        comparison_df: pd.DataFrame
    ) -> None:
        with self._lock:
            session = self.get_or_create_session(session_id)
            session["ml_meta"] = ml_meta
            session["trained_models"] = trained_models
            session["model_evaluations"] = model_evaluations
            session["comparison_df"] = comparison_df
            session["updated_at"] = time.time()

    def create_job(self, job_id: str, session_id: str, total_models: int) -> None:
        with self._lock:
            self._jobs[job_id] = {
                "job_id": job_id,
                "session_id": session_id,
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
