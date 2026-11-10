"""
Machine Learning Studio Routes for OpenDataLens.
Supports target candidate detection, asynchronous model training, and job status polling.
"""

import uuid
import threading
from typing import Dict, Any, List
from fastapi import APIRouter, HTTPException, BackgroundTasks
import pandas as pd

from backend.api.session_store import store
from backend.api.models import (
    TargetCandidatesResponse,
    TrainModelsRequest,
    TrainJobStartResponse,
    JobStatusResponse
)
from core.ml_studio import (
    detect_target_candidates,
    prepare_train_test_split,
    train_model_pipeline
)
from core.evaluator import (
    evaluate_classification_model,
    evaluate_regression_model,
    build_comparison_table
)
from core.config import CLASSIFICATION_MODELS, REGRESSION_MODELS

router = APIRouter(prefix="/ml", tags=["ML Studio"])


@router.get("/target-candidates", response_model=TargetCandidatesResponse)
def get_target_candidates(session_id: str = "default"):
    df = store.get_dataset(session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="No active dataset in session.")

    candidates = detect_target_candidates(df)
    meta = store.get_metadata(session_id) or {}
    suggested_task = meta.get("task", "classification")

    return TargetCandidatesResponse(
        classification=candidates.get("classification", []),
        regression=candidates.get("regression", []),
        suggested_task=suggested_task,
        columns=df.columns.tolist()
    )


def _async_train_worker(job_id: str, req: TrainModelsRequest):
    """Background worker function executing the training and evaluation loop."""
    try:
        store.update_job(job_id, status="running", progress=5, current_model="Preparing Data Split")
        df = store.get_dataset(req.session_id)
        if df is None:
            raise ValueError("Dataset not found in session.")

        # Split
        X_train, X_test, y_train, y_test = prepare_train_test_split(
            df=df,
            feature_cols=req.feature_cols,
            target_col=req.target_col,
            test_size=req.test_size,
            random_state=req.random_state,
            problem_type=req.problem_type
        )
        store.update_job(job_id, progress=15, current_model="Data Partitioned")

        available_labels = CLASSIFICATION_MODELS if req.problem_type == "classification" else REGRESSION_MODELS
        trained_models_dict = {}
        evaluations_dict = {}

        total_models = len(req.selected_models)
        for i, model_key in enumerate(req.selected_models):
            model_display_name = available_labels.get(model_key, model_key)
            store.update_job(
                job_id,
                progress=15 + int(((i) / total_models) * 75),
                current_model=f"Training {model_display_name} ({i+1}/{total_models})"
            )

            pipe, fit_time = train_model_pipeline(
                model_name=model_key,
                problem_type=req.problem_type,
                X_train=X_train,
                y_train=y_train,
                scaler_type=req.scaler_type,
                random_state=req.random_state
            )

            # Evaluate on unseen test set
            if req.problem_type == "classification":
                eval_res = evaluate_classification_model(
                    pipeline=pipe,
                    X_test=X_test,
                    y_test=y_test,
                    model_display_name=model_display_name,
                    fit_time=fit_time
                )
            else:
                eval_res = evaluate_regression_model(
                    pipeline=pipe,
                    X_test=X_test,
                    y_test=y_test,
                    model_display_name=model_display_name,
                    fit_time=fit_time
                )

            trained_models_dict[model_key] = pipe
            evaluations_dict[model_key] = eval_res

        store.update_job(job_id, progress=95, current_model="Synthesizing Comparison Scoreboard")
        comp_df = build_comparison_table(evaluations_dict, problem_type=req.problem_type)

        # Store in session
        ml_meta = {
            "problem_type": req.problem_type,
            "target_col": req.target_col,
            "feature_cols": req.feature_cols,
            "test_size": req.test_size,
            "scaler": req.scaler_type,
            "X_test": X_test,
            "y_test": y_test
        }
        store.set_ml_results(
            session_id=req.session_id,
            ml_meta=ml_meta,
            trained_models=trained_models_dict,
            model_evaluations=evaluations_dict,
            comparison_df=comp_df
        )

        store.update_job(job_id, status="completed", progress=100, current_model="Complete")

    except Exception as exc:
        store.update_job(job_id, status="failed", error=str(exc))


@router.post("/train", response_model=TrainJobStartResponse)
def start_model_training(req: TrainModelsRequest):
    df = store.get_dataset(req.session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="No active dataset in session. Load a dataset first.")

    if not req.feature_cols:
        raise HTTPException(status_code=400, detail="Feature columns list cannot be empty.")
    if req.target_col not in df.columns:
        raise HTTPException(status_code=400, detail=f"Target column '{req.target_col}' not found in dataset.")
    if not req.selected_models:
        raise HTTPException(status_code=400, detail="Must select at least one model architecture.")

    job_id = f"job_{uuid.uuid4().hex[:10]}"
    store.create_job(job_id=job_id, session_id=req.session_id, total_models=len(req.selected_models))

    # Launch background thread for non-blocking asynchronous execution
    thread = threading.Thread(target=_async_train_worker, args=(job_id, req), daemon=True)
    thread.start()

    return TrainJobStartResponse(
        job_id=job_id,
        status="running",
        total_models=len(req.selected_models),
        message="Model training initiated in background job."
    )


@router.get("/train/status/{job_id}", response_model=JobStatusResponse)
def get_job_status(job_id: str):
    job = store.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Training job '{job_id}' not found.")

    return JobStatusResponse(
        job_id=job["job_id"],
        status=job["status"],
        progress=job["progress"],
        current_model=job["current_model"],
        error=job["error"],
        completed_at=job.get("completed_at")
    )
