"""
Report Generation and Artifact Export Routes for OpenDataLens.
"""

import io
from fastapi import APIRouter, HTTPException, Response
from fastapi.responses import StreamingResponse, PlainTextResponse, HTMLResponse
import pandas as pd

from backend.api.session_store import store
from core.report_generator import (
    generate_html_report,
    generate_json_report,
    generate_markdown_report,
    export_model_pipeline_bytes
)
from core.evaluator import get_best_model_summary

router = APIRouter(prefix="/reports", tags=["Reports"])


def _get_report_context(session_id: str):
    session = store.get_or_create_session(session_id)
    dataset_meta = session.get("metadata")
    quality_summary = session.get("quality_analysis")
    eval_dict = session.get("model_evaluations")
    comp_df = session.get("comparison_df")
    ml_meta = session.get("ml_meta", {})
    problem_type = ml_meta.get("problem_type", "classification")

    if not dataset_meta or not quality_summary or not eval_dict or comp_df is None:
        raise HTTPException(
            status_code=400,
            detail="Incomplete session context. Please load a dataset and train models before exporting reports."
        )

    best_name, primary_metric, best_val = get_best_model_summary(comp_df, problem_type=problem_type)
    best_info = {
        "name": best_name,
        "metric": primary_metric,
        "score": best_val
    }

    return dataset_meta, quality_summary, eval_dict, best_info, problem_type


@router.get("/html")
def download_html_report(session_id: str = "default"):
    dataset_meta, quality_summary, eval_dict, best_info, problem_type = _get_report_context(session_id)
    html_content = generate_html_report(
        dataset_meta=dataset_meta,
        quality_summary=quality_summary,
        model_evaluations=eval_dict,
        best_model_info=best_info,
        problem_type=problem_type
    )
    filename = f"OpenDataLens_Report_{dataset_meta.get('id', 'dataset')}.html"
    return Response(
        content=html_content,
        media_type="text/html",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/json")
def download_json_report(session_id: str = "default"):
    dataset_meta, quality_summary, eval_dict, best_info, problem_type = _get_report_context(session_id)
    json_content = generate_json_report(
        dataset_meta=dataset_meta,
        quality_summary=quality_summary,
        model_evaluations=eval_dict,
        best_model_info=best_info,
        problem_type=problem_type
    )
    filename = f"OpenDataLens_Report_{dataset_meta.get('id', 'dataset')}.json"
    return Response(
        content=json_content,
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/markdown")
def download_markdown_report(session_id: str = "default"):
    dataset_meta, quality_summary, eval_dict, best_info, problem_type = _get_report_context(session_id)
    md_content = generate_markdown_report(
        dataset_meta=dataset_meta,
        quality_summary=quality_summary,
        model_evaluations=eval_dict,
        best_model_info=best_info,
        problem_type=problem_type
    )
    filename = f"OpenDataLens_Report_{dataset_meta.get('id', 'dataset')}.md"
    return Response(
        content=md_content,
        media_type="text/markdown",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/model/{model_key}")
def download_model_joblib(model_key: str, session_id: str = "default"):
    session = store.get_or_create_session(session_id)
    trained_models = session.get("trained_models", {})
    eval_dict = session.get("model_evaluations", {})
    ml_meta = session.get("ml_meta", {})
    dataset_meta = session.get("metadata", {})

    pipeline = trained_models.get(model_key)
    if not pipeline:
        # Match by name
        for k, v in eval_dict.items():
            if v.get("model_name") == model_key:
                pipeline = trained_models.get(k)
                model_key = k
                break

    if not pipeline:
        raise HTTPException(
            status_code=404,
            detail=f"Model '{model_key}' not found in trained models. Available: {list(trained_models.keys())}"
        )

    export_meta = {
        "model_name": eval_dict.get(model_key, {}).get("model_name", model_key),
        "problem_type": ml_meta.get("problem_type"),
        "target": ml_meta.get("target_col"),
        "features": ml_meta.get("feature_cols"),
        "scaler": ml_meta.get("scaler"),
        "metrics": eval_dict.get(model_key, {}).get("metrics")
    }

    joblib_bytes = export_model_pipeline_bytes(pipeline, export_meta)
    filename = f"opendatalens_{model_key}_{dataset_meta.get('id', 'model')}.joblib"

    return StreamingResponse(
        io.BytesIO(joblib_bytes),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/dataset-csv")
def download_dataset_csv(session_id: str = "default"):
    df = store.get_dataset(session_id)
    dataset_meta = store.get_metadata(session_id) or {}
    if df is None:
        raise HTTPException(status_code=404, detail="No active dataset to export.")

    csv_data = df.to_csv(index=False).encode("utf-8")
    filename = f"opendatalens_{dataset_meta.get('id', 'dataset')}.csv"

    return StreamingResponse(
        io.BytesIO(csv_data),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
