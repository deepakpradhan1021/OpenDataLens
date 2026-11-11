"""
Machine Learning Studio Routes for OpenDataLens.
Supports target candidate detection, asynchronous model training with K-Fold cross validation,
experiment run history tracking, and job status polling.
"""

import time
import uuid
import secrets
import logging
import threading
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks, Request, Query
from fastapi.responses import JSONResponse
import pandas as pd

logger = logging.getLogger(__name__)

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
    train_model_pipeline,
    run_kfold_cross_validation
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
    start_total_time = time.time()
    try:
        # Check if job was cancelled or workspace was cleared before starting
        job = store.get_job(job_id)
        if not job or job.get("status") == "cancelled" or not store.has_session(req.session_id):
            logger.info(f"[ML Worker] Aborting job {job_id} as workspace session was reset.")
            return

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
            # Check for cancellation before training each model architecture
            job = store.get_job(job_id)
            if not job or job.get("status") == "cancelled" or not store.has_session(req.session_id):
                logger.info(f"[ML Worker] Aborting job {job_id} mid-training as workspace session was reset.")
                return

            model_display_name = available_labels.get(model_key, model_key)
            store.update_job(
                job_id,
                progress=15 + int(((i) / total_models) * 70),
                current_model=f"Training {model_display_name} ({i+1}/{total_models})"
            )

            # 1. Leak-free Cross-Validation
            try:
                cv_scores = run_kfold_cross_validation(
                    model_name=model_key,
                    problem_type=req.problem_type,
                    X_train=X_train,
                    y_train=y_train,
                    scaler_type=req.scaler_type,
                    cv_folds=req.cv_folds,
                    random_state=req.random_state
                )
            except Exception as cv_err:
                logger.warning(f"[ML Worker] CV failed for {model_key}: {cv_err}")
                cv_scores = None

            # 2. Train on full X_train for test evaluation
            pipe, fit_time = train_model_pipeline(
                model_name=model_key,
                problem_type=req.problem_type,
                X_train=X_train,
                y_train=y_train,
                scaler_type=req.scaler_type,
                random_state=req.random_state
            )

            # 3. Evaluate on unseen test set
            if req.problem_type == "classification":
                eval_res = evaluate_classification_model(
                    pipeline=pipe,
                    X_test=X_test,
                    y_test=y_test,
                    model_display_name=model_display_name,
                    fit_time=fit_time,
                    cv_scores=cv_scores
                )
            else:
                eval_res = evaluate_regression_model(
                    pipeline=pipe,
                    X_test=X_test,
                    y_test=y_test,
                    model_display_name=model_display_name,
                    fit_time=fit_time,
                    cv_scores=cv_scores
                )

            trained_models_dict[model_key] = pipe
            evaluations_dict[model_key] = eval_res

        # Check for cancellation before final write
        if not store.has_session(req.session_id):
            logger.info(f"[ML Worker] Workspace session was cleared during final evaluation. Not recreating.")
            return

        store.update_job(job_id, progress=92, current_model="Synthesizing Comparison Scoreboard")
        comp_df = build_comparison_table(evaluations_dict, problem_type=req.problem_type)

        # Store in session
        ml_meta = {
            "problem_type": req.problem_type,
            "target_col": req.target_col,
            "feature_cols": req.feature_cols,
            "test_size": req.test_size,
            "scaler": req.scaler_type,
            "cv_folds": req.cv_folds,
            "X_test": X_test,
            "y_test": y_test
        }
        saved = store.set_ml_results(
            session_id=req.session_id,
            ml_meta=ml_meta,
            trained_models=trained_models_dict,
            model_evaluations=evaluations_dict,
            comparison_df=comp_df
        )
        if not saved:
            logger.info(f"[ML Worker] Session {req.session_id} was removed prior to saving results.")
            return

        # Record Experiment Run
        duration_sec = round(time.time() - start_total_time, 2)
        dataset_meta = store.get_metadata(req.session_id) or {}
        exp_record = {
            "run_id": f"run_{secrets.token_hex(6)}",
            "timestamp": time.time(),
            "duration_seconds": duration_sec,
            "dataset_name": dataset_meta.get("name", "Active Dataset"),
            "dataset_rows": len(df),
            "dataset_cols": len(df.columns),
            "problem_type": req.problem_type,
            "target_col": req.target_col,
            "feature_count": len(req.feature_cols),
            "selected_models": [available_labels.get(k, k) for k in req.selected_models],
            "cv_folds": req.cv_folds,
            "scaler": req.scaler_type,
            "champion_model": comp_df.iloc[0]["Model"] if not comp_df.empty else "N/A",
            "scoreboard": comp_df.to_dict(orient="records")
        }
        store.record_experiment(req.session_id, exp_record)

        store.update_job(job_id, status="completed", progress=100, current_model="Complete")

    except Exception as exc:
        logger.exception(f"Training job {job_id} encountered an error: {exc}")
        safe_msg = "Model training failed due to incompatible feature types, excessive missing values, or insufficient samples."
        store.update_job(job_id, status="failed", error=safe_msg)


@router.post("/train", response_model=TrainJobStartResponse)
def start_model_training(req: TrainModelsRequest):
    df = store.get_dataset(req.session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="No active dataset in session. Load a dataset first.")

    # 1. Validate feature columns non-empty
    if not req.feature_cols:
        raise HTTPException(status_code=400, detail="Feature columns list cannot be empty.")

    # 2. Validate target column exists in dataframe
    if req.target_col not in df.columns:
        raise HTTPException(status_code=400, detail=f"Target column '{req.target_col}' not found in dataset.")

    # 3. Validate target column is NEVER in feature columns (strict target leakage prevention)
    if req.target_col in req.feature_cols:
        raise HTTPException(
            status_code=400,
            detail=f"Target column '{req.target_col}' cannot be included in feature columns (target leakage violation)."
        )

    # 4. Validate all feature columns actually exist in the dataframe
    missing_features = [col for col in req.feature_cols if col not in df.columns]
    if missing_features:
        raise HTTPException(
            status_code=400,
            detail=f"The following feature columns do not exist in the dataset: {missing_features}"
        )

    # 5. Validate problem type
    if req.problem_type not in ["classification", "regression"]:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid problem type: '{req.problem_type}'. Supported types: 'classification', 'regression'."
        )

    # 6. Validate selected models
    if not req.selected_models:
        raise HTTPException(status_code=400, detail="Must select at least one model architecture.")

    allowed_models = CLASSIFICATION_MODELS if req.problem_type == "classification" else REGRESSION_MODELS
    invalid_models = [m for m in req.selected_models if m not in allowed_models]
    if invalid_models:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid model architectures for {req.problem_type}: {invalid_models}. Allowed: {list(allowed_models.keys())}"
        )

    # 7. Generate a cryptographically strong unguessable job identifier
    job_id = f"job_{uuid.uuid4().hex}_{secrets.token_hex(6)}"
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
def get_job_status(
    job_id: str,
    request: Request,
    session_id: Optional[str] = Query(None, description="Workspace session ID to verify ownership")
):
    job = store.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Training job '{job_id}' not found.")

    # Check job ownership using caller workspace ID from query or header
    caller_session = session_id or request.headers.get("X-Session-ID")
    if caller_session and caller_session.strip() != "default" and job["session_id"] != "default":
        if caller_session.strip() != job["session_id"]:
            raise HTTPException(
                status_code=403,
                detail="Access denied: Training job belongs to another workspace session."
            )

    return JobStatusResponse(
        job_id=job["job_id"],
        status=job["status"],
        progress=job["progress"],
        current_model=job["current_model"],
        error=job["error"],
        completed_at=job.get("completed_at")
    )


@router.get("/experiments")
def get_experiments(session_id: str = "default"):
    """List reproducible experiment runs recorded in this workspace session."""
    runs = store.get_experiments(session_id)
    return {
        "session_id": session_id,
        "total_runs": len(runs),
        "experiments": runs
    }


@router.get("/experiments/export")
def export_experiments(session_id: str = "default"):
    """Export all experiment tracking records as JSON."""
    runs = store.get_experiments(session_id)
    return JSONResponse(
        content={
            "platform": "OpenDataLens",
            "session_id": session_id,
            "exported_at": time.time(),
            "total_runs": len(runs),
            "experiments": runs
        },
        headers={
            "Content-Disposition": f"attachment; filename=experiments_{session_id[:8]}.json"
        }
    )
