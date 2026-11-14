"""
Data Quality and Diagnostics Routes for OpenDataLens.
"""

from typing import Dict, Any, List
from fastapi import APIRouter, HTTPException, Query
import pandas as pd
import numpy as np

from backend.api.session_store import store
from backend.api.models import (
    QualityAnalysisResponse,
    QualityRecommendation,
    CleanActionRequest,
    CleanActionResponse,
    UndoRedoRequest,
    HistoryResponse,
    HistoryItem
)
from backend.api.routes.datasets import build_preview_response
from core.quality_analyzer import analyze_data_quality, generate_quality_recommendations
from core.cleaner import apply_cleaning_action

router = APIRouter(prefix="/quality", tags=["Quality"])


@router.get("/analysis", response_model=QualityAnalysisResponse)
def get_quality_analysis(session_id: str = "default"):
    df = store.get_dataset(session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="No active dataset in session. Load or upload a dataset first.")

    analysis = store.get_quality_analysis(session_id)
    if analysis is None:
        analysis = analyze_data_quality(df)
        store.set_quality_analysis(session_id, analysis)

    raw_recs = generate_quality_recommendations(analysis)
    recommendations = [QualityRecommendation(**r) for r in raw_recs]

    # Compute correlation matrix data
    num_df = df.select_dtypes(include=[np.number])
    corr_data = None
    if num_df.shape[1] >= 2:
        corr_matrix = num_df.corr().round(3).replace({np.nan: None})
        corr_data = {
            "columns": corr_matrix.columns.tolist(),
            "values": corr_matrix.values.tolist()
        }

    return QualityAnalysisResponse(
        overview=analysis["overview"],
        missing_summary=analysis["missing_values"]["column_summary"],
        column_types=analysis["column_types"],
        numeric_stats=analysis["statistics"]["numeric_stats"],
        categorical_stats=analysis["statistics"]["categorical_stats"],
        recommendations=recommendations,
        correlation_matrix=corr_data
    )


@router.get("/distribution")
def get_column_distribution(
    column: str = Query(..., description="Column name to profile"),
    session_id: str = "default"
):
    df = store.get_dataset(session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="No active dataset in session.")
    if column not in df.columns:
        raise HTTPException(status_code=400, detail=f"Column '{column}' not found in dataset.")

    s = df[column].dropna()
    if s.empty:
        return {"type": "empty", "column": column, "data": []}

    if pd.api.types.is_numeric_dtype(s):
        # Generate histogram bins
        counts, bin_edges = np.histogram(s, bins=min(20, max(5, s.nunique())))
        bins_data = []
        for i in range(len(counts)):
            bins_data.append({
                "bin": f"{bin_edges[i]:.2f} - {bin_edges[i+1]:.2f}",
                "min": round(float(bin_edges[i]), 2),
                "max": round(float(bin_edges[i+1]), 2),
                "count": int(counts[i])
            })
        return {
            "type": "numeric",
            "column": column,
            "min": round(float(s.min()), 2),
            "max": round(float(s.max()), 2),
            "mean": round(float(s.mean()), 2),
            "median": round(float(s.median()), 2),
            "bins": bins_data
        }
    else:
        # Category frequency counts
        top_cats = s.value_counts().head(15)
        cat_data = [
            {"category": str(cat), "count": int(cnt)}
            for cat, cnt in top_cats.items()
        ]
        return {
            "type": "categorical",
            "column": column,
            "unique": int(s.nunique()),
            "categories": cat_data
        }


@router.post("/clean", response_model=CleanActionResponse)
def clean_dataset(req: CleanActionRequest):
    """Apply an interactive data cleaning action, record snapshot in undo stack, and re-profile."""
    df = store.get_dataset(req.session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="No active dataset in session. Load or upload a dataset first.")

    try:
        cleaned_df, action_msg = apply_cleaning_action(df, req.action_type, req.params)
        cp_info = store.push_checkpoint(req.session_id, cleaned_df, action_msg)
        analysis = analyze_data_quality(cleaned_df)
        store.set_quality_analysis(req.session_id, analysis)
        meta = store.get_metadata(req.session_id) or {}
        preview = build_preview_response(cleaned_df, meta, req.session_id)

        return CleanActionResponse(
            status="success",
            action=action_msg,
            rows=int(cleaned_df.shape[0]),
            cols=int(cleaned_df.shape[1]),
            can_undo=cp_info["can_undo"],
            can_redo=cp_info["can_redo"],
            preview=preview
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/undo", response_model=CleanActionResponse)
def undo_clean(req: UndoRedoRequest):
    """Undo the last data transformation and restore previous dataset snapshot."""
    res = store.undo_checkpoint(req.session_id)
    if not res:
        raise HTTPException(status_code=400, detail="No further actions to undo.")

    df = store.get_dataset(req.session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="No active dataset found after undo.")

    analysis = analyze_data_quality(df)
    store.set_quality_analysis(req.session_id, analysis)
    meta = store.get_metadata(req.session_id) or {}
    preview = build_preview_response(df, meta, req.session_id)

    return CleanActionResponse(
        status="success",
        action=res["action"],
        rows=res["rows"],
        cols=res["cols"],
        can_undo=res["can_undo"],
        can_redo=res["can_redo"],
        preview=preview
    )


@router.post("/redo", response_model=CleanActionResponse)
def redo_clean(req: UndoRedoRequest):
    """Redo previously undone data transformation."""
    res = store.redo_checkpoint(req.session_id)
    if not res:
        raise HTTPException(status_code=400, detail="No further actions to redo.")

    df = store.get_dataset(req.session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="No active dataset found after redo.")

    analysis = analyze_data_quality(df)
    store.set_quality_analysis(req.session_id, analysis)
    meta = store.get_metadata(req.session_id) or {}
    preview = build_preview_response(df, meta, req.session_id)

    return CleanActionResponse(
        status="success",
        action=res["action"],
        rows=res["rows"],
        cols=res["cols"],
        can_undo=res["can_undo"],
        can_redo=res["can_redo"],
        preview=preview
    )


@router.get("/history", response_model=HistoryResponse)
def get_clean_history(session_id: str = "default"):
    """Fetch timeline of cleaning transformations and undo/redo state."""
    data = store.get_history(session_id)
    history_items = [HistoryItem(**item) for item in data.get("history", [])]
    return HistoryResponse(
        history=history_items,
        can_undo=data.get("can_undo", False),
        can_redo=data.get("can_redo", False),
        last_action=data.get("last_action")
    )
