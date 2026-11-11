"""
Evaluation and Comparison Routes for OpenDataLens.
Provides leaderboard scoring, per-model diagnostics, residual metrics, and
Explainable AI (Permutation Importance & Native Model Feature Weights).
"""

from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
import numpy as np

from backend.api.session_store import store
from backend.api.models import (
    ModelComparisonResponse,
    ModelDiagnosticsResponse,
    ChampionModelInfo
)
from core.evaluator import (
    get_best_model_summary,
    compute_model_explainability,
    explain_single_prediction
)

router = APIRouter(prefix="/evaluation", tags=["Evaluation"])


class ExplainSampleRequest(BaseModel):
    session_id: str = "default"
    model_key: Optional[str] = None
    sample_index: int = 0


@router.get("/comparison", response_model=ModelComparisonResponse)
def get_comparison(session_id: str = "default"):
    session = store.get_or_create_session(session_id)
    comp_df = session.get("comparison_df")
    eval_dict = session.get("model_evaluations")
    ml_meta = session.get("ml_meta", {})
    problem_type = ml_meta.get("problem_type", "classification")

    if comp_df is None or not eval_dict:
        raise HTTPException(
            status_code=404,
            detail="No evaluation results found for this session. Train models in ML Studio first."
        )

    best_name, primary_metric, best_val = get_best_model_summary(comp_df, problem_type=problem_type)
    champion = ChampionModelInfo(name=best_name, metric=primary_metric, score=best_val)

    scoreboard = comp_df.to_dict(orient="records")
    available_models = [ev.get("model_name", k) for k, ev in eval_dict.items()]

    return ModelComparisonResponse(
        problem_type=problem_type,
        champion=champion,
        scoreboard=scoreboard,
        available_models=available_models
    )


@router.get("/diagnostics/{model_key}", response_model=ModelDiagnosticsResponse)
def get_model_diagnostics(model_key: str, session_id: str = "default"):
    session = store.get_or_create_session(session_id)
    eval_dict = session.get("model_evaluations", {})
    ml_meta = session.get("ml_meta", {})
    problem_type = ml_meta.get("problem_type", "classification")

    ev = eval_dict.get(model_key)
    if not ev:
        ev = next((v for v in eval_dict.values() if v.get("model_name") == model_key), None)

    if not ev:
        raise HTTPException(
            status_code=404,
            detail=f"Model '{model_key}' not found in active evaluations. Available: {list(eval_dict.keys())}"
        )

    diag = ModelDiagnosticsResponse(
        model_name=ev.get("model_name", model_key),
        problem_type=problem_type,
        fit_time=ev.get("fit_time", 0.0),
        metrics=ev.get("metrics", {})
    )

    if problem_type == "classification":
        diag.confusion_matrix = ev.get("confusion_matrix")
        diag.class_labels = ev.get("class_labels")
        diag.classification_report = ev.get("classification_report")
    else:
        diag.predictions = ev.get("predictions")
        diag.ground_truth = ev.get("ground_truth")
        if diag.predictions and diag.ground_truth:
            diag.residuals = [round(float(g - p), 4) for g, p in zip(diag.ground_truth, diag.predictions)]

    return diag


@router.get("/explainability")
def get_explainability(
    model_key: Optional[str] = None,
    session_id: str = "default"
):
    """
    Generate Explainable AI insights (Permutation Importance and native weights)
    for the champion model or specified architecture.
    """
    session = store.get_or_create_session(session_id)
    trained_models = session.get("trained_models", {})
    ml_meta = session.get("ml_meta", {})
    comp_df = session.get("comparison_df")

    if not trained_models or comp_df is None:
        raise HTTPException(
            status_code=404,
            detail="No trained models available in this session. Train models in ML Studio first."
        )

    problem_type = ml_meta.get("problem_type", "classification")
    feature_cols = ml_meta.get("feature_cols", [])
    X_test = ml_meta.get("X_test")
    y_test = ml_meta.get("y_test")

    if X_test is None or y_test is None:
        raise HTTPException(status_code=400, detail="Test evaluation partition missing from session.")

    # Match target model key
    target_key = model_key
    if not target_key:
        best_name, _, _ = get_best_model_summary(comp_df, problem_type=problem_type)
        eval_dict = session.get("model_evaluations", {})
        for k, v in eval_dict.items():
            if v.get("model_name") == best_name:
                target_key = k
                break
        if not target_key and trained_models:
            target_key = list(trained_models.keys())[0]

    pipeline = trained_models.get(target_key)
    if not pipeline:
        raise HTTPException(
            status_code=404,
            detail=f"Model '{target_key}' not found in trained models. Available: {list(trained_models.keys())}"
        )

    display_name = session.get("model_evaluations", {}).get(target_key, {}).get("model_name", target_key)
    explain_data = compute_model_explainability(
        pipeline=pipeline,
        X_test=X_test,
        y_test=y_test,
        feature_names=feature_cols,
        problem_type=problem_type
    )
    explain_data["model_key"] = target_key
    explain_data["model_name"] = display_name
    explain_data["available_models"] = list(trained_models.keys())

    return explain_data


@router.post("/explain-sample")
def explain_sample_prediction(req: ExplainSampleRequest):
    """
    Inspect local feature impacts for a specific test sample index.
    """
    session = store.get_or_create_session(req.session_id)
    trained_models = session.get("trained_models", {})
    ml_meta = session.get("ml_meta", {})
    X_test = ml_meta.get("X_test")

    if not trained_models or X_test is None:
        raise HTTPException(status_code=404, detail="No trained models or test dataset in session.")

    target_key = req.model_key or list(trained_models.keys())[0]
    pipeline = trained_models.get(target_key)
    if not pipeline:
        raise HTTPException(status_code=404, detail=f"Model '{target_key}' not found.")

    idx = max(0, min(req.sample_index, len(X_test) - 1))
    sample_row = X_test.iloc[idx]
    problem_type = ml_meta.get("problem_type", "classification")
    feature_cols = ml_meta.get("feature_cols", [])

    return explain_single_prediction(
        pipeline=pipeline,
        sample_row=sample_row,
        feature_names=feature_cols,
        problem_type=problem_type
    )
