"""
Dataset Ingestion and Exploration Routes for OpenDataLens.
"""

from typing import List, Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Query
import pandas as pd
import numpy as np

from backend.api.session_store import store
from backend.api.models import (
    CuratedDatasetItem,
    LoadCuratedRequest,
    LoadHFRequest,
    HFDatasetCard,
    DatasetPreviewResponse,
    ColumnSchemaInfo
)
from core.dataset_loader import (
    get_sample_datasets_list,
    load_curated_dataset,
    search_hf_datasets,
    load_hf_dataset_via_api,
    load_csv_dataset
)
from core.quality_analyzer import analyze_data_quality

router = APIRouter(prefix="/datasets", tags=["Datasets"])


def _build_preview_response(df: pd.DataFrame, meta: dict, session_id: str, limit: int = 50) -> DatasetPreviewResponse:
    cols_info: List[ColumnSchemaInfo] = []
    for col in df.columns:
        s = df[col]
        non_null = int(s.count())
        sample_val = str(s.dropna().iloc[0]) if non_null > 0 else None
        cols_info.append(ColumnSchemaInfo(
            name=col,
            dtype=str(s.dtype),
            non_null_count=non_null,
            null_count=int(s.isna().sum()),
            unique_count=int(s.nunique()),
            sample_value=sample_val
        ))

    # Clean records for JSON compliance (replace NaN, Infinity with None)
    clean_sample = df.head(limit).replace({np.nan: None, np.inf: None, -np.inf: None})
    records = clean_sample.to_dict(orient="records")

    memory_bytes = int(df.memory_usage(deep=True).sum())
    memory_mb = round(memory_bytes / (1024 * 1024), 2)

    return DatasetPreviewResponse(
        session_id=session_id,
        metadata=meta,
        total_rows=int(df.shape[0]),
        total_cols=int(df.shape[1]),
        memory_mb=memory_mb,
        columns=cols_info,
        records=records
    )


@router.get("/curated", response_model=List[CuratedDatasetItem])
def list_curated():
    return [CuratedDatasetItem(**d) for d in get_sample_datasets_list()]


@router.post("/load-curated", response_model=DatasetPreviewResponse)
async def load_curated(req: LoadCuratedRequest):
    try:
        df, meta = load_curated_dataset(req.dataset_id)
        store.set_dataset(req.session_id, df, meta)
        analysis = analyze_data_quality(df)
        store.set_quality_analysis(req.session_id, analysis)
        return _build_preview_response(df, meta, req.session_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/search-hf", response_model=List[HFDatasetCard])
def search_hf(query: str = "tabular", limit: int = 9):
    try:
        results = search_hf_datasets(query=query, limit=limit)
        return [HFDatasetCard(**r) for r in results]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to query Hugging Face API: {str(e)}")


@router.post("/load-hf", response_model=DatasetPreviewResponse)
def load_hf(req: LoadHFRequest):
    try:
        df, meta = load_hf_dataset_via_api(
            dataset_name=req.dataset_name,
            split=req.split,
            max_rows=req.max_rows
        )
        store.set_dataset(req.session_id, df, meta)
        analysis = analyze_data_quality(df)
        store.set_quality_analysis(req.session_id, analysis)
        return _build_preview_response(df, meta, req.session_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024  # 25 MB limit


@router.post("/upload-csv", response_model=DatasetPreviewResponse)
async def upload_csv(
    file: UploadFile = File(...),
    session_id: str = Form("default")
):
    if not file.filename or not (file.filename.lower().endswith(".csv") or file.filename.lower().endswith(".txt")):
        raise HTTPException(
            status_code=400,
            detail="Invalid file format. Only standard CSV (.csv) or text delimiter (.txt) files are supported."
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail="Uploaded file exceeds the maximum 25 MB size limit."
        )

    try:
        df, meta = load_csv_dataset(content, filename=file.filename or "upload.csv")
        store.set_dataset(session_id, df, meta)
        analysis = analyze_data_quality(df)
        store.set_quality_analysis(session_id, analysis)
        return _build_preview_response(df, meta, session_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to process CSV file: {str(e)}")


@router.post("/clear-workspace")
def clear_workspace(session_id: str = Query("default")):
    """Clear all loaded datasets, models, evaluations, and jobs for the active workspace."""
    cleared = store.clear_session(session_id)
    return {
        "status": "cleared",
        "session_id": session_id,
        "cleared": cleared,
        "message": "Workspace successfully cleared and resources released."
    }


@router.get("/active", response_model=DatasetPreviewResponse)
def get_active_dataset(session_id: str = "default", limit: int = 50):
    df = store.get_dataset(session_id)
    meta = store.get_metadata(session_id)
    if df is None or meta is None:
        raise HTTPException(status_code=404, detail="No active dataset in session. Load or upload a dataset first.")
    return _build_preview_response(df, meta, session_id, limit=limit)
