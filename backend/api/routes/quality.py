"""
Data Quality and Diagnostics Routes for OpenDataLens.
"""

from typing import Dict, Any, List
from fastapi import APIRouter, HTTPException, Query
import pandas as pd
import numpy as np

from backend.api.session_store import store
from backend.api.models import QualityAnalysisResponse, QualityRecommendation
from core.quality_analyzer import analyze_data_quality, generate_quality_recommendations

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
