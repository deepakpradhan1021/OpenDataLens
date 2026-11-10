"""
Evaluation and Comparison Routes for OpenDataLens.
"""

from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Query
import numpy as np

from backend.api.session_store import store
from backend.api.models import (
    ModelComparisonResponse,
    ModelDiagnosticsResponse,
    ChampionModelInfo
)
from core.evaluator import get_best_model_summary

router = APIRouter(prefix="/evaluation", tags=["Evaluation"])


@router.get("/comparison", response_model=ModelComparisonResponse)
def get_comparison(session_id: str = "default"):
    session = store.get_or_create_session(session_id)
    comp_df = session.get("comparison_df")
    eval_dict = session.get("model_evaluations")
    ml_meta = session.get("ml_meta", {})
    problem_type = ml_meta.get("problem_type", "classification")

    if comp_df is None or not eval_dict:
        raise HTTPException(status_code=404, detail="No evaluation results found for this session. Train models in ML Studio first.")

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

    # Match by key or by display name
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
