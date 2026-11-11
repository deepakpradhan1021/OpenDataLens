"""
Data Drift Detection Route for OpenDataLens.
Compares a reference baseline dataset to a target dataset using PSI,
Kolmogorov-Smirnov statistics, categorical TVD, and schema shift analysis.
"""

from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query, UploadFile, File, Form
from pydantic import BaseModel
import pandas as pd

from backend.api.session_store import store
from core.drift_detector import detect_dataset_drift
from core.dataset_loader import load_csv_dataset

router = APIRouter(prefix="/drift", tags=["Data Drift"])


class DriftAnalyzeRequest(BaseModel):
    session_id: str = "default"
    split_ratio: float = 0.5  # Ratio to split active dataset if no target uploaded


@router.get("/analyze")
def analyze_active_dataset_drift(
    session_id: str = "default",
    split_ratio: float = 0.5
):
    """
    Evaluate drift between training reference split and evaluation target split
    or two partitions of the active dataset.
    """
    df = store.get_dataset(session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="No active dataset in session. Load a dataset first.")

    if len(df) < 15:
        raise HTTPException(status_code=400, detail="Dataset must have at least 15 rows to perform statistical drift analysis.")

    session = store.get_or_create_session(session_id)
    ml_meta = session.get("ml_meta", {})
    x_test = ml_meta.get("X_test")

    # If ML Studio has already partitioned X_train and X_test, use X_train as reference and X_test as target
    if x_test is not None and isinstance(x_test, pd.DataFrame) and len(x_test) >= 5:
        target_df = x_test
        feature_cols = ml_meta.get("feature_cols", list(df.columns))
        # Exclude target_df from original df to get reference
        ref_indices = [idx for idx in df.index if idx not in target_df.index]
        reference_df = df.loc[ref_indices, [c for c in feature_cols if c in df.columns]]
    else:
        # Default partition: chronologically / by index partition
        split_point = int(len(df) * (1.0 - split_ratio))
        split_point = max(5, min(split_point, len(df) - 5))
        reference_df = df.iloc[:split_point]
        target_df = df.iloc[split_point:]

    drift_report = detect_dataset_drift(reference_df, target_df)
    return drift_report


@router.post("/compare-csv")
async def compare_target_csv_drift(
    target_file: UploadFile = File(...),
    session_id: str = Form("default")
):
    """
    Compare the currently active workspace dataset (reference) against an uploaded target CSV dataset.
    """
    ref_df = store.get_dataset(session_id)
    if ref_df is None:
        raise HTTPException(
            status_code=404,
            detail="No active reference dataset in workspace. Load or upload a baseline dataset first."
        )

    try:
        content = await target_file.read()
        target_df, _ = load_csv_dataset(content, filename=target_file.filename or "target.csv")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse uploaded target CSV: {str(e)}")

    if len(target_df) < 5:
        raise HTTPException(status_code=400, detail="Target CSV contains insufficient rows (< 5).")

    drift_report = detect_dataset_drift(ref_df, target_df)
    return drift_report
