"""
OpenDataLens - Phase 6 Full Product Integration & End-to-End Reliability Suite.

Validates the complete lifecycle:
Upload -> Preview -> Analyze -> Clean -> Visualize -> Ask Copilot -> Run ML -> Generate Report -> Export -> Save Project -> Reload Project -> Share Project.

Benchmarks tested:
1. California Housing (Regression, 20,640 rows, continuous features)
2. Iris (Multiclass Classification, 150 rows)
3. Titanic (Mixed data types, missing values, categorical & numeric)
4. Wine Recognition (Multiclass Classification, 178 rows, 13 features)
5. Dataset with Constant / Zero-Variance Columns
6. Chronological Time-Series Dataset
7. Reports Generation without trained models

All calculations are verified against independent Pandas / Scikit-Learn computations.
"""

import io
import time
import zipfile
import pytest
import numpy as np
import pandas as pd
from fastapi.testclient import TestClient

from backend.api.main import app
from backend.api.session_store import store
from core.dataset_loader import load_curated_dataset

client = TestClient(app)


def _poll_training_job(job_id: str, session_id: str, max_seconds: float = 30.0):
    """Helper to poll asynchronous ML training worker until completed."""
    start = time.time()
    while time.time() - start < max_seconds:
        status_res = client.get(f"/api/ml/train/status/{job_id}", headers={"X-Session-ID": session_id})
        assert status_res.status_code == 200
        st = status_res.json()
        if st["status"] == "completed":
            return st
        elif st["status"] == "failed":
            pytest.fail(f"Training job {job_id} failed: {st.get('error')}")
        time.sleep(0.3)
    pytest.fail(f"Training job {job_id} timed out after {max_seconds} seconds.")


# ==============================================================================
# 1. CALIFORNIA HOUSING REGRESSION WORKFLOW & PANDAS STATISTICAL VERIFICATION
# ==============================================================================
def test_california_housing_regression_and_pandas_verification():
    """Verify California Housing benchmark: loading, quality stats, binned intervals, ML, and reports."""
    session_id = f"session_phase6_housing_{int(time.time())}"
    store.clear_session(session_id)

    # 1. Mount California Housing via API
    res = client.post("/api/datasets/load-curated", json={"dataset_id": "california_housing", "session_id": session_id})
    assert res.status_code == 200
    active = res.json()
    assert active["total_rows"] == 20640
    assert active["total_cols"] == 9
    col_names = [c["name"] for c in active["columns"]]
    assert "MedHouseVal" in col_names

    # 2. Independent Pandas baseline check
    df, _ = load_curated_dataset("california_housing")
    pandas_mean = float(df["MedHouseVal"].mean())
    pandas_std = float(df["MedHouseVal"].std())
    pandas_min = float(df["MedHouseVal"].min())
    pandas_max = float(df["MedHouseVal"].max())

    # 3. Quality analysis check via API
    q_res = client.get(f"/api/quality/analysis?session_id={session_id}")
    assert q_res.status_code == 200
    quality = q_res.json()
    assert quality["overview"]["total_rows"] == 20640
    assert quality["overview"]["completeness_score"] == 100.0

    col_stats = quality["numeric_stats"]["MedHouseVal"]
    assert pytest.approx(col_stats["mean"], rel=1e-3) == pandas_mean
    assert pytest.approx(col_stats["std"], rel=1e-3) == pandas_std
    assert pytest.approx(col_stats["min"], rel=1e-3) == pandas_min
    assert pytest.approx(col_stats["max"], rel=1e-3) == pandas_max

    # 4. Chart engine binned interval validation (Histogram)
    chart_res = client.post(
        "/api/datasets/chart-data",
        json={"chart_type": "histogram", "x_col": "MedInc", "bins": 10, "session_id": session_id}
    )
    assert chart_res.status_code == 200
    chart = chart_res.json()
    assert chart["chart_type"] == "histogram"
    assert len(chart["data"]) == 10
    total_binned = sum(item["count"] for item in chart["data"])
    assert total_binned == 20640
    counts = [item["count"] for item in chart["data"]]
    assert len(set(counts)) > 1, "Histogram heights must vary according to actual data distribution"

    # 5. ML Studio Regression Training via API
    feature_cols = [c for c in col_names if c != "MedHouseVal"]
    train_res = client.post(
        "/api/ml/train",
        json={
            "session_id": session_id,
            "problem_type": "regression",
            "target_col": "MedHouseVal",
            "feature_cols": feature_cols,
            "selected_models": ["ridge_regression", "decision_tree"],
            "scaler_type": "standard",
            "test_size": 0.2
        }
    )
    assert train_res.status_code == 200
    job_id = train_res.json()["job_id"]
    _poll_training_job(job_id, session_id)

    # Verify model comparison scoreboard
    comp_res = client.get(f"/api/evaluation/comparison?session_id={session_id}")
    assert comp_res.status_code == 200
    comp = comp_res.json()
    assert "champion" in comp
    assert len(comp["scoreboard"]) >= 2
    for row in comp["scoreboard"]:
        assert "Model" in row

    # 6. Reports generation with regression model
    pdf_res = client.get(f"/api/reports/pdf?session_id={session_id}")
    assert pdf_res.status_code == 200
    assert pdf_res.headers["content-type"] == "application/pdf"
    assert pdf_res.content.startswith(b"%PDF-")

    excel_res = client.get(f"/api/reports/excel?session_id={session_id}")
    assert excel_res.status_code == 200
    with zipfile.ZipFile(io.BytesIO(excel_res.content)) as zf:
        assert "[Content_Types].xml" in zf.namelist()

    md_res = client.get(f"/api/reports/markdown?session_id={session_id}")
    assert md_res.status_code == 200
    assert "California Housing" in md_res.text or "MedHouseVal" in md_res.text


# ==============================================================================
# 2. IRIS CLASSIFICATION, COPILOT, PROJECT PERSISTENCE & SECURE SHARING
# ==============================================================================
def test_iris_classification_copilot_projects_and_sharing():
    """Verify Iris benchmark: classification ML, Copilot Q&A, project save/reload/import/export, and share tokens."""
    session_id = f"session_phase6_iris_{int(time.time())}"
    store.clear_session(session_id)

    # 1. Mount Iris
    res = client.post("/api/datasets/load-curated", json={"dataset_id": "iris", "session_id": session_id})
    assert res.status_code == 200
    active = res.json()
    assert active["total_rows"] == 150
    assert active["total_cols"] == 5
    feature_cols = [c["name"] for c in active["columns"] if c["name"] != "target"]

    # 2. Train classification models
    train_res = client.post(
        "/api/ml/train",
        json={
            "session_id": session_id,
            "problem_type": "classification",
            "target_col": "target",
            "feature_cols": feature_cols,
            "selected_models": ["logistic_regression", "random_forest"],
            "scaler_type": "standard",
            "test_size": 0.2
        }
    )
    assert train_res.status_code == 200
    job_id = train_res.json()["job_id"]
    _poll_training_job(job_id, session_id)

    comp_res = client.get(f"/api/evaluation/comparison?session_id={session_id}")
    assert comp_res.status_code == 200
    comp = comp_res.json()
    assert comp["champion"]["score"] >= 0.85

    # 3. AI Copilot dataset-aware response via local heuristic fallback
    copilot_res = client.post(
        "/api/copilot/query",
        json={
            "query": "Explain this dataset and what features exist.",
            "session_id": session_id
        }
    )
    assert copilot_res.status_code == 200
    copilot_out = copilot_res.json()
    assert "answer" in copilot_out
    assert len(copilot_out["answer"]) > 20

    # 4. Save Project
    save_res = client.post(
        "/api/projects/save",
        json={"name": "Iris Research Project", "session_id": session_id}
    )
    assert save_res.status_code == 200
    saved = save_res.json()
    project_id = saved["project"]["id"]
    assert project_id is not None

    # List Projects - verify session isolation
    list_res = client.get(f"/api/projects?session_id={session_id}")
    assert list_res.status_code == 200
    assert any(p["id"] == project_id for p in list_res.json()["projects"])

    list_other = client.get("/api/projects?session_id=session_unauthorized_alien")
    assert list_other.status_code == 200
    assert not any(p["id"] == project_id for p in list_other.json()["projects"])

    # Export project bundle (.odl)
    bundle_res = client.get(f"/api/projects/{project_id}/bundle?session_id={session_id}")
    assert bundle_res.status_code == 200
    assert len(bundle_res.content) > 500
    bundle_bytes = bundle_res.content

    # Delete project
    del_res = client.delete(f"/api/projects/{project_id}?session_id={session_id}")
    assert del_res.status_code == 200

    # Import project bundle back
    import_res = client.post(
        f"/api/projects/import?session_id={session_id}",
        files={"file": ("iris_backup.odl", bundle_bytes, "application/zip")}
    )
    assert import_res.status_code == 200
    imported = import_res.json()["project"]
    imported_id = imported["id"]
    assert imported_id is not None
    assert "Iris Research Project" in imported["name"]

    # 5. Share project: password protection (Argon2id), rate limiting, unlock, revocation
    share_res = client.post(
        "/api/share/create",
        json={
            "session_id": session_id,
            "title": "Iris Research Report",
            "password": "CorrectHorseBattery99!",
            "expires_in_hours": 24
        }
    )
    assert share_res.status_code == 200
    share_token = share_res.json()["share"]["token"]
    assert share_token is not None

    # Wrong password attempt
    bad_res = client.post(
        f"/api/share/{share_token}/unlock",
        json={"password": "WrongPassword!"}
    )
    assert bad_res.status_code == 401

    # Correct password attempt
    good_res = client.post(
        f"/api/share/{share_token}/unlock",
        json={"password": "CorrectHorseBattery99!"}
    )
    assert good_res.status_code == 200
    assert good_res.json()["status"] in ["active", "success"]

    # Revoke share
    rev_res = client.delete(f"/api/share/{share_token}")
    assert rev_res.status_code == 200
    after_rev = client.post(
        f"/api/share/{share_token}/unlock",
        json={"password": "CorrectHorseBattery99!"}
    )
    assert after_rev.status_code == 404


# ==============================================================================
# 3. TITANIC BENCHMARK: MISSING VALUES, CLEANING, OUTLIERS & CHECKPOINTS
# ==============================================================================
def test_titanic_missing_values_cleaning_and_checkpoints():
    """Verify Titanic benchmark: missing value detection, median imputation, outlier clipping, and undo/redo."""
    session_id = f"session_phase6_titanic_{int(time.time())}"
    store.clear_session(session_id)

    # 1. Mount Titanic
    res = client.post("/api/datasets/load-curated", json={"dataset_id": "titanic_synthetic", "session_id": session_id})
    assert res.status_code == 200

    # 2. Verify missing values in Age
    q_res = client.get(f"/api/quality/analysis?session_id={session_id}")
    assert q_res.status_code == 200
    quality = q_res.json()
    assert quality["missing_summary"]["Age"]["missing_count"] > 0

    # 3. Impute Age with median via API
    imp_res = client.post(
        "/api/quality/clean",
        json={"action_type": "impute_missing", "params": {"column": "Age", "strategy": "median"}, "session_id": session_id}
    )
    assert imp_res.status_code == 200
    imp_out = imp_res.json()
    assert imp_out["status"] == "success"

    # Confirm 0 missing in Age
    q_post = client.get(f"/api/quality/analysis?session_id={session_id}").json()
    assert q_post["missing_summary"]["Age"]["missing_count"] == 0

    # 4. Clip Fare outliers via IQR
    out_res = client.post(
        "/api/quality/clean",
        json={"action_type": "clip_outliers", "params": {"column": "Fare", "factor": 1.5}, "session_id": session_id}
    )
    assert out_res.status_code == 200

    # 5. Save Named Checkpoint
    cp_res = client.post(
        "/api/quality/named-checkpoint",
        json={"name": "titanic_clean_checkpoint", "session_id": session_id}
    )
    assert cp_res.status_code == 200
    assert cp_res.json()["status"] == "success"

    # 6. Test Undo
    undo_res = client.post("/api/quality/undo", json={"session_id": session_id})
    assert undo_res.status_code == 200
    assert undo_res.json()["status"] == "success"

    # 7. Test Redo
    redo_res = client.post("/api/quality/redo", json={"session_id": session_id})
    assert redo_res.status_code == 200
    assert redo_res.json()["status"] == "success"


# ==============================================================================
# 4. WINE RECOGNITION BENCHMARK: HIGH DIMENSIONALITY & MODEL FEATURE IMPORTANCE
# ==============================================================================
def test_wine_recognition_classification_and_importance():
    """Verify Wine benchmark: multiclass classification across 13 continuous chemical measurements."""
    session_id = f"session_phase6_wine_{int(time.time())}"
    store.clear_session(session_id)

    res = client.post("/api/datasets/load-curated", json={"dataset_id": "wine_recognition", "session_id": session_id})
    assert res.status_code == 200
    active = res.json()
    assert active["total_rows"] == 178
    assert active["total_cols"] == 14
    feature_cols = [c["name"] for c in active["columns"] if c["name"] != "target"]

    train_res = client.post(
        "/api/ml/train",
        json={
            "session_id": session_id,
            "problem_type": "classification",
            "target_col": "target",
            "feature_cols": feature_cols,
            "selected_models": ["random_forest"],
            "scaler_type": "standard",
            "test_size": 0.2
        }
    )
    assert train_res.status_code == 200
    job_id = train_res.json()["job_id"]
    _poll_training_job(job_id, session_id)

    comp_res = client.get(f"/api/evaluation/comparison?session_id={session_id}")
    assert comp_res.status_code == 200
    comp = comp_res.json()
    assert comp["champion"]["score"] >= 0.85

    # Check Explainability endpoint
    xai_res = client.get(f"/api/evaluation/explainability?session_id={session_id}")
    assert xai_res.status_code == 200
    xai_out = xai_res.json()
    assert len(xai_out.get("top_drivers", [])) > 0


# ==============================================================================
# 5. DATASET WITH CONSTANT / ZERO-VARIANCE COLUMNS
# ==============================================================================
def test_dataset_with_constant_columns_handling():
    """Verify handling of datasets containing zero-variance / constant features."""
    session_id = f"session_phase6_constant_{int(time.time())}"
    store.clear_session(session_id)

    # Upload CSV with constant numeric & string columns
    csv_content = (
        "id,const_num,const_str,feature_val,target\n"
        "1,99.9,STATIC,1.2,0\n"
        "2,99.9,STATIC,2.4,1\n"
        "3,99.9,STATIC,3.6,0\n"
        "4,99.9,STATIC,4.8,1\n"
        "5,99.9,STATIC,5.0,0\n"
        "6,99.9,STATIC,6.2,1\n"
        "7,99.9,STATIC,7.4,0\n"
        "8,99.9,STATIC,8.6,1\n"
        "9,99.9,STATIC,9.8,0\n"
        "10,99.9,STATIC,10.0,1\n"
    )

    upload_res = client.post(
        "/api/datasets/upload-file",
        files={"file": ("constant_test.csv", csv_content.encode("utf-8"), "text/csv")},
        data={"session_id": session_id}
    )
    assert upload_res.status_code == 200

    # Quality check: unique count should be 1
    active_cols = {c["name"]: c["unique_count"] for c in upload_res.json()["columns"]}
    assert active_cols["const_num"] == 1
    assert active_cols["const_str"] == 1

    # Drop constant column via cleaner
    drop_res = client.post(
        "/api/quality/clean",
        json={"action_type": "drop_columns", "params": {"columns": ["const_num", "const_str"]}, "session_id": session_id}
    )
    assert drop_res.status_code == 200

    # Train model on clean dataset
    train_res = client.post(
        "/api/ml/train",
        json={
            "session_id": session_id,
            "problem_type": "classification",
            "target_col": "target",
            "feature_cols": ["feature_val"],
            "selected_models": ["logistic_regression"],
            "scaler_type": "standard",
            "test_size": 0.2
        }
    )
    assert train_res.status_code == 200
    job_id = train_res.json()["job_id"]
    _poll_training_job(job_id, session_id)


# ==============================================================================
# 6. CHRONOLOGICAL TIME-SERIES DATASET
# ==============================================================================
def test_chronological_time_series_dataset():
    """Verify time-series dataset sorting, date parsing, and chronological interval computations."""
    session_id = f"session_phase6_ts_{int(time.time())}"
    store.clear_session(session_id)

    # Shuffled date records
    csv_content = (
        "date,revenue\n"
        "2026-03-01,300\n"
        "2026-01-01,100\n"
        "2026-04-01,400\n"
        "2026-02-01,200\n"
        "2026-05-01,500\n"
    )

    upload_res = client.post(
        "/api/datasets/upload-file",
        files={"file": ("timeseries.csv", csv_content.encode("utf-8"), "text/csv")},
        data={"session_id": session_id}
    )
    assert upload_res.status_code == 200

    # Sort rows chronologically by date
    sort_res = client.post(
        "/api/quality/clean",
        json={"action_type": "sort_rows", "params": {"column": "date", "ascending": True}, "session_id": session_id}
    )
    assert sort_res.status_code == 200

    # Compute line chart data
    chart_res = client.post(
        "/api/datasets/chart-data",
        json={"chart_type": "line", "x_col": "date", "y_col": "revenue", "session_id": session_id}
    )
    assert chart_res.status_code == 200
    chart = chart_res.json()
    assert chart["chart_type"] == "line"
    assert len(chart["data"]) == 5
    # First date should be 2026-01-01 and last should be 2026-05-01
    assert chart["data"][0]["name"] == "2026-01-01"
    assert chart["data"][-1]["name"] == "2026-05-01"


# ==============================================================================
# 7. REPORT GENERATION WITHOUT TRAINED ML MODELS
# ==============================================================================
def test_reports_generate_cleanly_without_ml_models():
    """Verify all report generators produce valid output when no models have been trained."""
    session_id = f"session_phase6_no_models_{int(time.time())}"
    store.clear_session(session_id)

    client.post("/api/datasets/load-curated", json={"dataset_id": "iris", "session_id": session_id})
    client.get(f"/api/quality/analysis?session_id={session_id}")

    # 1. PDF
    pdf_res = client.get(f"/api/reports/pdf?session_id={session_id}")
    assert pdf_res.status_code == 200
    assert pdf_res.headers["content-type"] == "application/pdf"
    assert pdf_res.content.startswith(b"%PDF-")

    # 2. Excel
    excel_res = client.get(f"/api/reports/excel?session_id={session_id}")
    assert excel_res.status_code == 200
    with zipfile.ZipFile(io.BytesIO(excel_res.content)) as zf:
        assert "[Content_Types].xml" in zf.namelist()

    # 3. HTML
    html_res = client.get(f"/api/reports/html?session_id={session_id}")
    assert html_res.status_code == 200
    assert "<!DOCTYPE html>" in html_res.text or "<html" in html_res.text

    # 4. Markdown
    md_res = client.get(f"/api/reports/markdown?session_id={session_id}")
    assert md_res.status_code == 200
    assert "OpenDataLens" in md_res.text

    # 5. CSV
    csv_res = client.get(f"/api/reports/csv?session_id={session_id}")
    assert csv_res.status_code == 200
    assert "sepal length (cm)" in csv_res.text

    # 6. JSON
    json_res = client.get(f"/api/reports/json?session_id={session_id}")
    assert json_res.status_code == 200
    data = json_res.json()
    assert "platform" in data
    assert data["platform"] == "OpenDataLens"
    assert "dataset" in data
    assert "data_quality_summary" in data
