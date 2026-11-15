"""
Report Generation and Artifact Export Routes for OpenDataLens.
Supports multi-format executive exports: PDF, Excel (.xlsx), HTML, JSON, Markdown, CSV, and Scikit-learn Pipeline (.joblib).
"""

import io
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Response, Query
from fastapi.responses import StreamingResponse, PlainTextResponse, HTMLResponse
import pandas as pd

from backend.api.session_store import store
from core.report_generator import (
    generate_pdf_report,
    generate_html_report,
    generate_json_report,
    generate_markdown_report,
    export_model_pipeline_bytes,
    generate_excel_workbook,
    generate_project_state_json
)
from core.evaluator import get_best_model_summary

router = APIRouter(prefix="/reports", tags=["Reports"])


def _get_report_context(session_id: str):
    session = store.get_or_create_session(session_id)
    df = store.get_dataset(session_id)
    dataset_meta = session.get("metadata")
    quality_summary = session.get("quality_analysis")
    eval_dict = session.get("model_evaluations", {})
    comp_df = session.get("comparison_df")
    ml_meta = session.get("ml_meta", {})
    problem_type = ml_meta.get("problem_type", "classification")
    clean_history = session.get("clean_history") or store.get_history(session_id).get("history", [])

    if not dataset_meta and df is None:
        raise HTTPException(
            status_code=400,
            detail="No active dataset available in session. Please load or upload a dataset before generating reports."
        )

    # Fallback metadata if only df is present
    if not dataset_meta and df is not None:
        dataset_meta = {
            "name": "Active Dataset",
            "source": "Uploaded Workspace",
            "total_rows": len(df),
            "total_columns": len(df.columns),
            "columns": list(df.columns)
        }

    best_info = None
    if comp_df is not None and not comp_df.empty:
        best_name, primary_metric, best_val = get_best_model_summary(comp_df, problem_type=problem_type)
        best_info = {
            "name": best_name,
            "metric": primary_metric,
            "score": best_val
        }

    return df, dataset_meta, quality_summary, eval_dict, best_info, problem_type, clean_history


@router.get("/pdf")
def download_pdf_report(
    session_id: str = "default",
    sections: Optional[str] = Query(None, description="Comma-separated sections: summary,quality,cleaning,ml,dictionary,sample")
):
    df, dataset_meta, quality_summary, eval_dict, best_info, problem_type, clean_history = _get_report_context(session_id)
    sec_list = [s.strip() for s in sections.split(",")] if sections else None

    pdf_bytes = generate_pdf_report(
        df=df,
        dataset_meta=dataset_meta,
        quality_summary=quality_summary,
        model_evaluations=eval_dict,
        best_model_info=best_info,
        problem_type=problem_type,
        sections=sec_list,
        clean_history=clean_history
    )
    ds_id = dataset_meta.get("id", dataset_meta.get("name", "dataset")).replace(" ", "_")
    filename = f"OpenDataLens_Report_{ds_id}.pdf"

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/preview")
def get_report_preview_data(session_id: str = "default"):
    """
    Returns structured data for the interactive in-browser report preview modal.
    """
    df, dataset_meta, quality_summary, eval_dict, best_info, problem_type, clean_history = _get_report_context(session_id)
    
    preview_rows = []
    columns_summary = []
    if df is not None:
        preview_rows = df.head(15).to_dict(orient="records")
        for col in df.columns:
            columns_summary.append({
                "name": str(col),
                "type": str(df[col].dtype),
                "missing": int(df[col].isna().sum()),
                "unique": int(df[col].nunique())
            })

    return {
        "dataset_meta": dataset_meta,
        "quality_summary": quality_summary or {},
        "clean_history": clean_history,
        "model_evaluations": eval_dict,
        "best_model_info": best_info,
        "problem_type": problem_type,
        "preview_records": preview_rows,
        "columns_summary": columns_summary
    }


@router.get("/html")
def download_html_report(session_id: str = "default", sections: Optional[str] = None):
    df, dataset_meta, quality_summary, eval_dict, best_info, problem_type, clean_history = _get_report_context(session_id)
    sec_list = [s.strip() for s in sections.split(",")] if sections else None

    html_content = generate_html_report(
        dataset_meta=dataset_meta,
        quality_summary=quality_summary,
        model_evaluations=eval_dict,
        best_model_info=best_info,
        problem_type=problem_type,
        clean_history=clean_history,
        sections=sec_list
    )
    filename = f"OpenDataLens_Report_{dataset_meta.get('id', 'dataset')}.html"
    return Response(
        content=html_content,
        media_type="text/html",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/json")
def download_json_report(session_id: str = "default"):
    df, dataset_meta, quality_summary, eval_dict, best_info, problem_type, clean_history = _get_report_context(session_id)
    json_content = generate_json_report(
        dataset_meta=dataset_meta,
        quality_summary=quality_summary,
        model_evaluations=eval_dict,
        best_model_info=best_info,
        problem_type=problem_type,
        clean_history=clean_history
    )
    filename = f"OpenDataLens_Report_{dataset_meta.get('id', 'dataset')}.json"
    return Response(
        content=json_content,
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/markdown")
def download_markdown_report(session_id: str = "default"):
    df, dataset_meta, quality_summary, eval_dict, best_info, problem_type, clean_history = _get_report_context(session_id)
    md_content = generate_markdown_report(
        dataset_meta=dataset_meta,
        quality_summary=quality_summary,
        model_evaluations=eval_dict,
        best_model_info=best_info,
        problem_type=problem_type,
        clean_history=clean_history
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


@router.get("/csv")
@router.get("/dataset-csv")
def download_dataset_csv(session_id: str = "default"):
    df = store.get_dataset(session_id)
    dataset_meta = store.get_metadata(session_id) or {}
    if df is None:
        raise HTTPException(status_code=404, detail="No active dataset to export.")

    csv_data = df.to_csv(index=False).encode("utf-8")
    ds_name = dataset_meta.get("id", dataset_meta.get("name", "dataset")).replace(" ", "_")
    filename = f"opendatalens_{ds_name}.csv"

    return StreamingResponse(
        io.BytesIO(csv_data),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/excel")
def download_excel_report(session_id: str = "default"):
    df, dataset_meta, quality_summary, eval_dict, best_info, problem_type, clean_history = _get_report_context(session_id)

    excel_bytes = generate_excel_workbook(
        df=df,
        dataset_meta=dataset_meta,
        quality_summary=quality_summary,
        model_evaluations=eval_dict,
        best_model_info=best_info,
        problem_type=problem_type,
        clean_history=clean_history
    )
    ds_id = dataset_meta.get("id", dataset_meta.get("name", "dataset")).replace(" ", "_")
    filename = f"OpenDataLens_Dossier_{ds_id}.xlsx"

    return StreamingResponse(
        io.BytesIO(excel_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/project-state")
def download_project_state(session_id: str = "default"):
    session = store.get_or_create_session(session_id)
    dataset_meta = session.get("metadata") or {}
    json_str = generate_project_state_json(session)
    filename = f"OpenDataLens_Project_{dataset_meta.get('id', 'workspace')}.json"

    return Response(
        content=json_str,
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
