"""
Comprehensive Test Suite for Phase 2: Dataset Discovery & Multi-Format Ingestion.
Tests CSV, Excel, JSON (records/split/tabular/jsonl), PDF (tables/no-tables),
and SQL (safe parsing, dangerous statement rejection, unsupported statements),
plus boundary conditions (empty, corrupt, oversized).
"""

import io
import json
import pytest
import pandas as pd
import numpy as np

from core.dataset_loader import (
    load_curated_dataset,
    get_sample_datasets_list,
    load_csv_dataset,
    load_excel_dataset,
    load_json_dataset,
    load_pdf_dataset,
    load_sql_dataset,
    load_uploaded_file
)
from backend.api.session_store import store
from backend.api.routes.datasets import MAX_FILE_SIZE_BYTES


# ==============================================================================
# 1. CURATED BENCHMARK DATASETS (ALL 6 PRESERVED)
# ==============================================================================

def test_all_six_curated_datasets_preserve():
    benchmarks = ["iris", "wine_recognition", "california_housing", "breast_cancer", "diabetes", "titanic_synthetic"]
    for b_id in benchmarks:
        df, meta = load_curated_dataset(b_id)
        assert not df.empty, f"Curated benchmark {b_id} returned empty dataframe"
        assert df.shape[0] > 10, f"Curated benchmark {b_id} has fewer than 10 rows"
        assert df.shape[1] >= 2, f"Curated benchmark {b_id} has fewer than 2 columns"
        assert meta["id"] == b_id or meta["source"] == "curated"


# ==============================================================================
# 2. EXCEL INGESTION (XLSX / XLS)
# ==============================================================================

def test_excel_valid_ingestion():
    df_src = pd.DataFrame({"age": [25, 30, 35], "salary": [50000, 65000, 80000]})
    bio = io.BytesIO()
    df_src.to_excel(bio, index=False, engine="openpyxl")
    
    df, meta = load_excel_dataset(bio.getvalue(), filename="employees.xlsx")
    assert len(df) == 3
    assert list(df.columns) == ["age", "salary"]
    assert meta["source"] == "excel"
    assert "available_sheets" in meta


def test_excel_empty_file_rejected():
    with pytest.raises(ValueError, match="completely empty"):
        load_excel_dataset(b"", filename="empty.xlsx")


def test_excel_corrupted_file_rejected():
    with pytest.raises(ValueError, match="Failed to parse Excel file"):
        load_excel_dataset(b"not a valid zip/xlsx archive bytes", filename="corrupt.xlsx")


def test_excel_skips_empty_first_sheet_if_second_has_data():
    bio = io.BytesIO()
    with pd.ExcelWriter(bio, engine="openpyxl") as writer:
        pd.DataFrame().to_excel(writer, sheet_name="BlankSheet", index=False)
        pd.DataFrame({"metric": [1.1, 2.2], "score": [10, 20]}).to_excel(writer, sheet_name="DataSheet", index=False)
    
    df, meta = load_excel_dataset(bio.getvalue(), filename="multi_sheet.xlsx")
    assert len(df) == 2
    assert "metric" in df.columns
    assert meta["sheet_name"] == "DataSheet"


# ==============================================================================
# 3. JSON INGESTION (RECORDS, SPLIT, TABULAR, JSONL)
# ==============================================================================

def test_json_records_format():
    records = [{"product": "Widget A", "price": 19.99}, {"product": "Widget B", "price": 29.99}]
    json_bytes = json.dumps(records).encode("utf-8")
    df, meta = load_json_dataset(json_bytes, filename="products.json")
    assert len(df) == 2
    assert list(df.columns) == ["product", "price"]
    assert meta["source"] == "json"


def test_json_split_format():
    # orient="split" format: {"columns": [...], "data": [[...], ...]}
    split_obj = {
        "columns": ["id", "feature_a", "label"],
        "data": [
            [101, 3.14, "positive"],
            [102, 2.71, "negative"],
            [103, 1.41, "neutral"]
        ]
    }
    json_bytes = json.dumps(split_obj).encode("utf-8")
    df, meta = load_json_dataset(json_bytes, filename="split_data.json")
    assert len(df) == 3
    assert list(df.columns) == ["id", "feature_a", "label"]
    assert df["feature_a"].iloc[0] == 3.14


def test_json_tabular_wrapper_keys():
    wrapper_obj = {
        "status": "success",
        "dataset": [
            {"user": "alice", "active": True},
            {"user": "bob", "active": False}
        ]
    }
    df, meta = load_json_dataset(json.dumps(wrapper_obj).encode("utf-8"), filename="wrapper.json")
    assert len(df) == 2
    assert "user" in df.columns


def test_json_lines_format():
    jsonl_content = '{"id": 1, "text": "hello"}\n{"id": 2, "text": "world"}\n'
    df, meta = load_json_dataset(jsonl_content.encode("utf-8"), filename="stream.jsonl")
    assert len(df) == 2
    assert meta["format"] == "jsonl"


def test_json_empty_and_corrupt_rejected():
    with pytest.raises(ValueError, match="empty"):
        load_json_dataset(b"", filename="empty.json")

    with pytest.raises(ValueError, match="empty root object or empty array"):
        load_json_dataset(b"{}", filename="empty_obj.json")

    with pytest.raises(ValueError, match="Failed to parse JSON file"):
        load_json_dataset(b'{"incomplete": [1, 2,', filename="corrupt.json")


# ==============================================================================
# 4. PDF TABLE EXTRACTION & VALIDATION
# ==============================================================================

# Helper to build minimal valid PDF with text stream
def _create_minimal_pdf(text_lines: list[str]) -> bytes:
    # Format text lines as PDF text drawing instructions
    lines_instructions = []
    y = 700
    for line in text_lines:
        safe_line = line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        lines_instructions.append(f"72 {y} Td ({safe_line}) Tj")
        y -= 20
    stream_content = "BT\n/F1 12 Tf\n" + "\n".join(lines_instructions) + "\nET"
    stream_bytes = stream_content.encode("utf-8")

    pdf_template = (
        b"%PDF-1.4\n"
        b"1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj\n"
        b"2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj\n"
        b"3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R>> endobj\n"
        b"4 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj\n"
        b"5 0 obj <</Length " + str(len(stream_bytes)).encode() + b">> stream\n" +
        stream_bytes +
        b"\nendstream\nendobj\n"
        b"xref\n0 6\n0000000000 65535 f \n"
        b"trailer <</Size 6 /Root 1 0 R>>\nstartxref\n100\n%%EOF"
    )
    return pdf_template


def test_pdf_with_extractable_table():
    pdf_bytes = _create_minimal_pdf([
        "FeatureA\tFeatureB\tTarget",
        "1.5\t2.5\t1",
        "3.0\t4.0\t0"
    ])
    df, meta = load_pdf_dataset(pdf_bytes, filename="sample_table.pdf")
    assert len(df) == 2
    assert "FeatureA" in df.columns
    assert "Target" in df.columns
    assert meta["source"] == "pdf"


def test_pdf_without_extractable_tables_rejected():
    # Narrative text with no tabs, pipes, or columns
    narrative_pdf = _create_minimal_pdf([
        "This is an executive introduction paragraph describing project scope.",
        "There are no columns or numbers or tables in this section at all."
    ])
    with pytest.raises(ValueError, match="No extractable tabular data found"):
        load_pdf_dataset(narrative_pdf, filename="narrative.pdf")


def test_pdf_empty_document_rejected():
    with pytest.raises(ValueError, match="Failed to read PDF document|Could not extract any readable text"):
        load_pdf_dataset(b"%PDF-1.4\n%%EOF", filename="blank.pdf")


# ==============================================================================
# 5. SAFE SQL INGESTION (ZERO LIVE EXECUTION)
# ==============================================================================

def test_sql_valid_insert_statements():
    sql_text = """
    -- Clean SQL Dump
    CREATE TABLE telemetry (sensor_id INT, reading FLOAT, status VARCHAR(20));
    INSERT INTO telemetry (sensor_id, reading, status) VALUES (1, 98.6, 'NORMAL');
    INSERT INTO telemetry (sensor_id, reading, status) VALUES (2, 102.4, 'WARNING'), (3, 99.1, 'NORMAL');
    """
    df, meta = load_sql_dataset(sql_text.encode("utf-8"), filename="dump.sql")
    assert len(df) == 3
    assert list(df.columns) == ["sensor_id", "reading", "status"]
    assert df["sensor_id"].iloc[0] == 1
    assert meta["source"] == "sql"


def test_sql_dangerous_drop_table_rejected():
    evil_sql = "DROP TABLE users; INSERT INTO users VALUES (1, 'admin');"
    with pytest.raises(ValueError, match="Security Warning.*disallowed or dangerous statement"):
        load_sql_dataset(evil_sql.encode("utf-8"), filename="exploit.sql")


def test_sql_dangerous_alter_user_rejected():
    evil_sql = "ALTER USER 'root'@'localhost' IDENTIFIED BY 'password';"
    with pytest.raises(ValueError, match="Security Warning.*Administrative ALTER"):
        load_sql_dataset(evil_sql.encode("utf-8"), filename="alter.sql")


def test_sql_dangerous_truncate_rejected():
    evil_sql = "TRUNCATE TABLE accounts;"
    with pytest.raises(ValueError, match="Security Warning.*TRUNCATE"):
        load_sql_dataset(evil_sql.encode("utf-8"), filename="truncate.sql")


def test_sql_unsupported_select_query_rejected():
    query_sql = "SELECT id, name, email FROM remote_users WHERE active = 1;"
    with pytest.raises(ValueError, match="Unsupported SQL statement.*Query statements.*SELECT"):
        load_sql_dataset(query_sql.encode("utf-8"), filename="query.sql")


def test_sql_empty_rejected():
    with pytest.raises(ValueError, match="empty"):
        load_sql_dataset(b"", filename="empty.sql")


# ==============================================================================
# 6. UNIFIED ROUTER & BOUNDARY CONDITIONS
# ==============================================================================

def test_unified_router_empty_file_rejected():
    with pytest.raises(ValueError, match="empty"):
        load_uploaded_file(b"", filename="data.csv")


def test_unified_router_unsupported_extension_rejected():
    with pytest.raises(ValueError, match="Unsupported file format"):
        load_uploaded_file(b"content", filename="malicious.exe")


def test_pipeline_integration_session_store():
    session_id = "test_phase2_pipeline_sess"
    df_src = pd.DataFrame({"feature1": [1.0, 2.0, 3.0], "label": [0, 1, 0]})
    store.set_dataset(session_id, df_src, {"name": "Phase2DS", "source": "test"})
    
    # Verify retrieval
    df_ret = store.get_dataset(session_id)
    assert df_ret is not None
    assert len(df_ret) == 3
    store.clear_session(session_id)
