"""
Unit and Integration Tests for Multi-Format Ingestion, Data Cleaner, and Undo/Redo Engine.
"""

import io
import json
import pytest
import pandas as pd
import numpy as np

from core.cleaner import (
    impute_missing,
    remove_duplicates,
    convert_column_dtype,
    rename_column,
    drop_columns,
    clip_outliers,
    filter_rows,
    apply_cleaning_action
)
from core.dataset_loader import (
    load_csv_dataset,
    load_excel_dataset,
    load_json_dataset,
    load_sql_dataset,
    load_uploaded_file
)
from backend.api.session_store import store
from backend.api.routes.datasets import upload_file, clear_workspace
from backend.api.routes.quality import clean_dataset, undo_clean, redo_clean, get_clean_history
from backend.api.models import CleanActionRequest, UndoRedoRequest


def test_cleaner_impute_missing():
    df = pd.DataFrame({
        "age": [20.0, 30.0, np.nan, 40.0],
        "category": ["A", "B", np.nan, "A"]
    })
    # Median imputation
    df_med, msg = impute_missing(df, "age", strategy="median")
    assert df_med["age"].isna().sum() == 0
    assert df_med["age"].iloc[2] == 30.0
    assert "median" in msg

    # Mode imputation
    df_mode, msg = impute_missing(df, "category", strategy="mode")
    assert df_mode["category"].isna().sum() == 0
    assert df_mode["category"].iloc[2] == "A"
    assert "mode" in msg

    # Drop rows
    df_drop, msg = impute_missing(df, "age", strategy="drop")
    assert len(df_drop) == 3
    assert "Dropped" in msg


def test_cleaner_remove_duplicates():
    df = pd.DataFrame({
        "id": [1, 1, 2, 3],
        "val": ["a", "a", "b", "c"]
    })
    df_clean, msg = remove_duplicates(df)
    assert len(df_clean) == 3
    assert "Removed 1 duplicate" in msg


def test_cleaner_convert_dtype_and_rename():
    df = pd.DataFrame({
        "num_str": ["10", "20", "30"],
        "old_col": [1, 2, 3]
    })
    df_num, msg = convert_column_dtype(df, "num_str", "numeric")
    assert pd.api.types.is_numeric_dtype(df_num["num_str"])

    df_ren, msg = rename_column(df_num, "old_col", "new_col")
    assert "new_col" in df_ren.columns
    assert "old_col" not in df_ren.columns


def test_cleaner_clip_outliers():
    df = pd.DataFrame({
        "val": [1.0, 2.0, 2.5, 3.0, 1000.0]  # extreme outlier
    })
    df_clipped, msg = clip_outliers(df, "val", lower_quantile=0.05, upper_quantile=0.90)
    assert df_clipped["val"].max() < 1000.0
    assert "Clipped" in msg


def test_cleaner_filter_rows():
    df = pd.DataFrame({
        "name": ["Alice", "Bob", "Charlie"],
        "score": [85, 42, 95]
    })
    df_filt, msg = filter_rows(df, "score", ">=", 80)
    assert len(df_filt) == 2
    assert "Filtered rows" in msg


def test_multi_format_json_loader():
    records = [{"id": 1, "name": "Alpha"}, {"id": 2, "name": "Beta"}]
    json_bytes = json.dumps(records).encode("utf-8")
    df, meta = load_json_dataset(json_bytes, filename="test.json")
    assert len(df) == 2
    assert list(df.columns) == ["id", "name"]
    assert meta["source"] == "json"


def test_multi_format_excel_loader():
    df_orig = pd.DataFrame({"colA": [10, 20], "colB": [30, 40]})
    bio = io.BytesIO()
    df_orig.to_excel(bio, index=False)
    bio.seek(0)

    df_loaded, meta = load_excel_dataset(bio.getvalue(), filename="test.xlsx")
    assert len(df_loaded) == 2
    assert list(df_loaded.columns) == ["colA", "colB"]
    assert meta["source"] == "excel"


def test_multi_format_sql_loader():
    sql_text = """
    CREATE TABLE users (id INT, username VARCHAR(50), active INT);
    INSERT INTO users VALUES (1, 'alice', 1);
    INSERT INTO users VALUES (2, 'bob', 0);
    """
    df, meta = load_sql_dataset(sql_text.encode("utf-8"), filename="dump.sql")
    assert len(df) == 2
    assert "id" in df.columns or "col_1" in df.columns
    assert meta["source"] == "sql"


def test_unified_upload_router():
    csv_bytes = b"x,y\n1,2\n3,4"
    df, meta = load_uploaded_file(csv_bytes, filename="points.csv")
    assert len(df) == 2
    assert meta["source"] == "csv"

    # Unsupported format rejection
    with pytest.raises(ValueError, match="Unsupported file format"):
        load_uploaded_file(b"data", filename="archive.zip")


def test_quality_cleaning_and_undo_redo_workflow():
    session_id = "test-session-undo-redo-12345"
    df_init = pd.DataFrame({
        "age": [25.0, np.nan, 45.0, 30.0],
        "salary": [50000, 60000, 75000, 50000]
    })
    store.set_dataset(session_id, df_init, {"name": "Test dataset", "rows": 4, "cols": 2})

    # Step 1: Clean action - impute missing
    req_clean = CleanActionRequest(
        session_id=session_id,
        action_type="impute_missing",
        params={"column": "age", "strategy": "median"}
    )
    clean_res = clean_dataset(req_clean)
    assert clean_res.can_undo is True
    assert clean_res.rows == 4

    # Verify history
    history = get_clean_history(session_id=session_id)
    assert len(history.history) == 1
    assert history.can_undo is True
    assert history.can_redo is False

    # Step 2: Undo
    undo_res = undo_clean(UndoRedoRequest(session_id=session_id))
    assert undo_res.can_redo is True
    df_reverted = store.get_dataset(session_id)
    assert df_reverted["age"].isna().sum() == 1  # NaN is restored!

    # Step 3: Redo
    redo_res = redo_clean(UndoRedoRequest(session_id=session_id))
    assert redo_res.can_undo is True
    df_restored = store.get_dataset(session_id)
    assert df_restored["age"].isna().sum() == 0  # Re-imputed!

    # Cleanup
    store.clear_session(session_id)


def test_excel_workbook_and_project_state():
    from core.report_generator import generate_excel_workbook, generate_project_state_json
    from backend.api.routes.reports import download_excel_report, download_project_state
    from core.copilot import answer_with_heuristics

    df = pd.DataFrame({
        "feature_1": [1.0, 2.0, 3.0, 4.0],
        "target": [0, 1, 0, 1]
    })
    session_id = "test_reports_sess"
    store.set_dataset(session_id, df, {"name": "TestDS", "id": "test_ds"})
    store.set_quality_analysis(session_id, {
        "overview": {
            "completeness_score": 100.0,
            "health_score": 98.0,
            "duplicate_rows": 0,
            "missing_cells": 0,
            "constant_columns": 0
        }
    })

    # Test Excel generation directly
    excel_bytes = generate_excel_workbook(
        df=df,
        dataset_meta={"name": "TestDS", "id": "test_ds"},
        quality_summary={"overview": {"completeness_score": 100.0, "health_score": 98.0}}
    )
    assert len(excel_bytes) > 0
    # Read back to verify valid workbook
    excel_file = io.BytesIO(excel_bytes)
    xl = pd.ExcelFile(excel_file, engine="openpyxl")
    assert "Overview" in xl.sheet_names
    assert "Column Dictionary" in xl.sheet_names
    assert "Quality Audit" in xl.sheet_names

    # Test Project state JSON
    session = store.get_or_create_session(session_id)
    json_str = generate_project_state_json(session)
    state = json.loads(json_str)
    assert state["platform"] == "OpenDataLens"
    assert state["metadata"]["name"] == "TestDS"

    # Test Routes
    resp_excel = download_excel_report(session_id)
    assert resp_excel.media_type == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

    resp_state = download_project_state(session_id)
    assert resp_state.media_type == "application/json"

    # Test Copilot new query handlers
    ans_clean = answer_with_heuristics("how to undo or redo data transformations?")
    assert ans_clean["intent"] == "data_cleaning_guide"

    ans_viz = answer_with_heuristics("how do I visualize bar charts and histograms?")
    assert ans_viz["intent"] == "visualization_guide"

    ans_fmt = answer_with_heuristics("what file formats are supported like excel or pdf?")
    assert ans_fmt["intent"] == "ingestion_guide"

    # Cleanup
    store.clear_session(session_id)

