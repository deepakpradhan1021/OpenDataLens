"""
Phase 5 Test Suite: Reports, Multi-Format Exports, Saved Projects & Secure Sharing.
Tests PDF generation, Excel with cleaning lineage, CSV exports,
project save/load/bundle, and secure time-limited/password-protected share links.
"""

import io
import json
import zipfile
import pytest
import openpyxl
from fastapi.testclient import TestClient

from backend.api.main import app
from backend.api.session_store import store

client = TestClient(app)


SESSION_ID = "session-phase5-test"


@pytest.fixture(autouse=True)
def setup_workspace():
    # Load iris dataset into test session
    store.clear_session(SESSION_ID)
    res = client.post("/api/datasets/load-curated", json={"dataset_id": "iris", "session_id": SESSION_ID})
    assert res.status_code == 200
    # Run quality analysis
    q_res = client.get(f"/api/quality/analysis?session_id={SESSION_ID}")
    assert q_res.status_code == 200


def test_reports_pdf_generation():
    res = client.get(f"/api/reports/pdf?session_id={SESSION_ID}")
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert res.content.startswith(b"%PDF-")
    assert len(res.content) > 1000


def test_reports_pdf_with_sections_filter():
    res = client.get(f"/api/reports/pdf?session_id={SESSION_ID}&sections=summary,quality,preview")
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert res.content.startswith(b"%PDF-")


def test_reports_preview_endpoint():
    res = client.get(f"/api/reports/preview?session_id={SESSION_ID}")
    assert res.status_code == 200
    data = res.json()
    assert "dataset_meta" in data
    assert "quality_summary" in data
    assert "preview_records" in data
    assert len(data["preview_records"]) > 0


def test_reports_csv_and_dataset_csv():
    res1 = client.get(f"/api/reports/csv?session_id={SESSION_ID}")
    assert res1.status_code == 200
    assert "text/csv" in res1.headers["content-type"]
    assert b"sepal_length" in res1.content or b"sepal" in res1.content.lower()

    res2 = client.get(f"/api/reports/dataset-csv?session_id={SESSION_ID}")
    assert res2.status_code == 200
    assert "text/csv" in res2.headers["content-type"]


def test_reports_excel_with_cleaning_lineage():
    # Execute a cleaning action to create lineage
    clean_res = client.post("/api/quality/clean", json={
        "action_type": "rename_column",
        "params": {"old_name": "sepal length (cm)", "new_name": "sepal_length_renamed"},
        "session_id": SESSION_ID
    })
    assert clean_res.status_code == 200

    # Download Excel
    res = client.get(f"/api/reports/excel?session_id={SESSION_ID}")
    assert res.status_code == 200
    wb = openpyxl.load_workbook(io.BytesIO(res.content))
    sheet_names = wb.sheetnames
    assert "Overview" in sheet_names
    assert "Column Dictionary" in sheet_names
    assert "Cleaning Lineage" in sheet_names


def test_projects_lifecycle():
    # 1. Save project
    save_res = client.post("/api/projects/save", json={
        "name": "Iris Test Project",
        "description": "Integration test analysis of Iris",
        "session_id": SESSION_ID
    })
    assert save_res.status_code == 200
    proj_data = save_res.json()["project"]
    proj_id = proj_data["id"]
    assert proj_data["name"] == "Iris Test Project"

    # 2. List projects
    list_res = client.get("/api/projects")
    assert list_res.status_code == 200
    projects = list_res.json()["projects"]
    assert any(p["id"] == proj_id for p in projects)

    # 3. Get single project
    detail_res = client.get(f"/api/projects/{proj_id}")
    assert detail_res.status_code == 200
    assert detail_res.json()["id"] == proj_id

    # 4. Restore project into a separate session
    restore_res = client.post(f"/api/projects/{proj_id}/load", json={
        "session_id": "restored-session-id"
    })
    assert restore_res.status_code == 200
    restored_meta = store.get_metadata("restored-session-id")
    assert restored_meta is not None
    restored_df = store.get_dataset("restored-session-id")
    assert restored_df is not None
    assert len(restored_df) > 0

    # 5. Delete project
    del_res = client.delete(f"/api/projects/{proj_id}")
    assert del_res.status_code == 200

    # 6. Verify 404 on deleted project
    get_del = client.get(f"/api/projects/{proj_id}")
    assert get_del.status_code == 404


def test_projects_bundle_export_and_import():
    # Save project first
    save_res = client.post("/api/projects/save", json={
        "name": "Bundle Test Project",
        "description": "Export bundle test",
        "session_id": SESSION_ID
    })
    proj_id = save_res.json()["project"]["id"]

    # Export bundle
    bundle_res = client.get(f"/api/projects/{proj_id}/bundle")
    assert bundle_res.status_code == 200
    assert bundle_res.headers["content-type"] == "application/zip"

    # Verify zip content
    zf = zipfile.ZipFile(io.BytesIO(bundle_res.content))
    names = zf.namelist()
    assert any(n.endswith(".json") for n in names)

    # Import bundle
    files = {"file": ("test.odl", bundle_res.content, "application/zip")}
    import_res = client.post("/api/projects/import", files=files)
    assert import_res.status_code == 200
    imp_data = import_res.json()["project"]
    assert "Imported" in imp_data["name"]

    # Clean up imported and original
    client.delete(f"/api/projects/{proj_id}")
    client.delete(f"/api/projects/{imp_data['id']}")


def test_share_lifecycle():
    # 1. Create share link
    create_res = client.post("/api/share/create", json={
        "session_id": SESSION_ID,
        "title": "Iris Public Report",
        "sections": ["summary", "quality", "preview"]
    })
    assert create_res.status_code == 200
    share_info = create_res.json()["share"]
    token = share_info["token"]
    assert token

    # 2. View shared report
    view_res = client.get(f"/api/share/{token}")
    assert view_res.status_code == 200
    data = view_res.json()
    assert data["status"] == "active"
    assert data["title"] == "Iris Public Report"
    assert "report_data" in data
    assert data["report_data"]["dataset_name"]

    # 3. Revoke share link
    del_res = client.delete(f"/api/share/{token}")
    assert del_res.status_code == 200

    # 4. View revoked share link returns 404
    view_del = client.get(f"/api/share/{token}")
    assert view_del.status_code == 404


def test_share_password_protection():
    # 1. Create password protected share
    create_res = client.post("/api/share/create", json={
        "session_id": SESSION_ID,
        "title": "Confidential Iris Report",
        "password": "secret_password_123"
    })
    assert create_res.status_code == 200
    token = create_res.json()["share"]["token"]

    # 2. View without password -> status password_required
    no_pw = client.get(f"/api/share/{token}")
    assert no_pw.status_code == 200
    assert no_pw.json()["status"] == "password_required"

    # 3. View with incorrect password -> 401
    wrong_pw = client.get(f"/api/share/{token}?password=wrong")
    assert wrong_pw.status_code == 401

    # 4. View with correct password via query param -> 200 active
    correct_query = client.get(f"/api/share/{token}?password=secret_password_123")
    assert correct_query.status_code == 200
    assert correct_query.json()["status"] == "active"

    # 5. View with correct password via header -> 200 active
    correct_header = client.get(
        f"/api/share/{token}",
        headers={"X-Share-Password": "secret_password_123"}
    )
    assert correct_header.status_code == 200
    assert correct_header.json()["status"] == "active"

    # Clean up
    client.delete(f"/api/share/{token}")
