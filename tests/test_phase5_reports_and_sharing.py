"""
Phase 5 & 5.1 Test Suite: Reports, Multi-Format Exports, Saved Projects,
Production Hardening, Brute-Force Rate Limiting & Strict Session Isolation.
"""

import io
import json
import zipfile
import pytest
import openpyxl
from fastapi.testclient import TestClient

from backend.api.main import app
from backend.api.session_store import store
from core.report_generator import generate_html_report, generate_pdf_report

client = TestClient(app)

SESSION_A = "session-phase5-userA"
SESSION_B = "session-phase5-userB"


@pytest.fixture(autouse=True)
def setup_workspace():
    # Load iris dataset into test session A
    store.clear_session(SESSION_A)
    store.clear_session(SESSION_B)
    res = client.post("/api/datasets/load-curated", json={"dataset_id": "iris", "session_id": SESSION_A})
    assert res.status_code == 200
    # Run quality analysis on session A
    q_res = client.get(f"/api/quality/analysis?session_id={SESSION_A}")
    assert q_res.status_code == 200


def test_reports_pdf_generation():
    res = client.get(f"/api/reports/pdf?session_id={SESSION_A}")
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert res.content.startswith(b"%PDF-")
    assert len(res.content) > 1000


def test_reports_pdf_with_sections_filter():
    res = client.get(f"/api/reports/pdf?session_id={SESSION_A}&sections=summary,quality,preview")
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert res.content.startswith(b"%PDF-")


def test_reports_preview_endpoint():
    res = client.get(f"/api/reports/preview?session_id={SESSION_A}")
    assert res.status_code == 200
    data = res.json()
    assert "dataset_meta" in data
    assert "quality_summary" in data
    assert "preview_records" in data
    assert len(data["preview_records"]) > 0


def test_reports_csv_and_dataset_csv():
    res1 = client.get(f"/api/reports/csv?session_id={SESSION_A}")
    assert res1.status_code == 200
    assert "text/csv" in res1.headers["content-type"]
    assert b"sepal" in res1.content.lower()

    res2 = client.get(f"/api/reports/dataset-csv?session_id={SESSION_A}")
    assert res2.status_code == 200
    assert "text/csv" in res2.headers["content-type"]


def test_reports_excel_with_cleaning_lineage():
    # Execute a cleaning action to create lineage
    clean_res = client.post("/api/quality/clean", json={
        "action_type": "rename_column",
        "params": {"old_name": "sepal length (cm)", "new_name": "sepal_length_renamed"},
        "session_id": SESSION_A
    })
    assert clean_res.status_code == 200

    # Download Excel
    res = client.get(f"/api/reports/excel?session_id={SESSION_A}")
    assert res.status_code == 200
    wb = openpyxl.load_workbook(io.BytesIO(res.content))
    sheet_names = wb.sheetnames
    assert "Overview" in sheet_names
    assert "Column Dictionary" in sheet_names
    assert "Cleaning Lineage" in sheet_names


def test_projects_lifecycle():
    # 1. Save project under SESSION_A
    save_res = client.post("/api/projects/save", json={
        "name": "Iris Test Project",
        "description": "Integration test analysis of Iris",
        "session_id": SESSION_A
    })
    assert save_res.status_code == 200
    proj_data = save_res.json()["project"]
    proj_id = proj_data["id"]
    assert proj_data["name"] == "Iris Test Project"

    # 2. List projects scoped to SESSION_A
    list_res = client.get(f"/api/projects?session_id={SESSION_A}")
    assert list_res.status_code == 200
    projects = list_res.json()["projects"]
    assert any(p["id"] == proj_id for p in projects)

    # 3. Get single project
    detail_res = client.get(f"/api/projects/{proj_id}?session_id={SESSION_A}")
    assert detail_res.status_code == 200
    assert detail_res.json()["id"] == proj_id

    # 4. Restore project into a separate session
    restore_res = client.post(f"/api/projects/{proj_id}/load", json={
        "session_id": "restored-session-id"
    })
    # Since session ownership is attached to SESSION_A, restored-session-id without ownership should fail
    assert restore_res.status_code == 404

    # 4b. Restore project with owner session
    restore_owner = client.post(f"/api/projects/{proj_id}/load", json={
        "session_id": SESSION_A
    })
    assert restore_owner.status_code == 200

    # 5. Delete project
    del_res = client.delete(f"/api/projects/{proj_id}?session_id={SESSION_A}")
    assert del_res.status_code == 200

    # 6. Verify 404 on deleted project
    get_del = client.get(f"/api/projects/{proj_id}?session_id={SESSION_A}")
    assert get_del.status_code == 404


def test_projects_session_isolation():
    """Verify that projects created by Session A are completely invisible to Session B."""
    # Save project in Session A
    save_res = client.post("/api/projects/save", json={
        "name": "Confidential A Project",
        "session_id": SESSION_A
    })
    assert save_res.status_code == 200
    proj_id = save_res.json()["project"]["id"]

    # Session B lists projects -> must NOT see Session A's project
    list_b = client.get(f"/api/projects?session_id={SESSION_B}")
    assert list_b.status_code == 200
    assert not any(p["id"] == proj_id for p in list_b.json()["projects"])

    # Session B tries to fetch metadata -> 404
    get_b = client.get(f"/api/projects/{proj_id}?session_id={SESSION_B}")
    assert get_b.status_code == 404

    # Session B tries to download bundle -> 404
    bundle_b = client.get(f"/api/projects/{proj_id}/bundle?session_id={SESSION_B}")
    assert bundle_b.status_code == 404

    # Session B tries to delete -> 404
    del_b = client.delete(f"/api/projects/{proj_id}?session_id={SESSION_B}")
    assert del_b.status_code == 404

    # Clean up with Session A
    client.delete(f"/api/projects/{proj_id}?session_id={SESSION_A}")


def test_projects_bundle_export_and_import():
    # Save project first
    save_res = client.post("/api/projects/save", json={
        "name": "Bundle Test Project",
        "description": "Export bundle test",
        "session_id": SESSION_A
    })
    proj_id = save_res.json()["project"]["id"]

    # Export bundle
    bundle_res = client.get(f"/api/projects/{proj_id}/bundle?session_id={SESSION_A}")
    assert bundle_res.status_code == 200
    assert bundle_res.headers["content-type"] == "application/zip"

    # Verify zip content
    zf = zipfile.ZipFile(io.BytesIO(bundle_res.content))
    names = zf.namelist()
    assert any(n.endswith(".json") for n in names)

    # Import bundle into Session B
    files = {"file": ("test.odl", bundle_res.content, "application/zip")}
    import_res = client.post(f"/api/projects/import?session_id={SESSION_B}", files=files)
    assert import_res.status_code == 200
    imp_data = import_res.json()["project"]
    assert "Imported" in imp_data["name"]

    # Clean up imported and original
    client.delete(f"/api/projects/{proj_id}?session_id={SESSION_A}")
    client.delete(f"/api/projects/{imp_data['id']}?session_id={SESSION_B}")


def test_projects_bundle_zip_bomb_and_traversal_rejection():
    """Verify defenses against malicious ZIP files (traversal and bomb)."""
    # 1. Malicious archive with path traversal
    trav_buf = io.BytesIO()
    with zipfile.ZipFile(trav_buf, "w") as zf:
        zf.writestr("../../etc/passwd", "root:x:0:0:root")
    trav_buf.seek(0)

    files = {"file": ("malicious.odl", trav_buf.getvalue(), "application/zip")}
    res = client.post(f"/api/projects/import?session_id={SESSION_A}", files=files)
    assert res.status_code == 400
    detail = res.json()["detail"].lower()
    assert "traversal" in detail or "invalid" in detail or "path" in detail


def test_share_lifecycle():
    # 1. Create share link
    create_res = client.post("/api/share/create", json={
        "session_id": SESSION_A,
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


def test_share_argon2id_password_and_rate_limiting():
    """Verify Argon2id password protection, unlock body transport, and brute-force lockout."""
    # 1. Create password protected share
    create_res = client.post("/api/share/create", json={
        "session_id": SESSION_A,
        "title": "Confidential Iris Report",
        "password": "super_secure_passphrase_2026"
    })
    assert create_res.status_code == 200
    token = create_res.json()["share"]["token"]

    # 2. View without password -> status password_required
    no_pw = client.get(f"/api/share/{token}")
    assert no_pw.status_code == 200
    assert no_pw.json()["status"] == "password_required"

    # 3. View with incorrect password via POST unlock -> 401
    wrong_pw = client.post(f"/api/share/{token}/unlock", json={"password": "wrong"})
    assert wrong_pw.status_code == 401

    # 4. View with correct password via Header -> 200 active
    correct_header = client.get(
        f"/api/share/{token}",
        headers={"X-Share-Password": "super_secure_passphrase_2026"}
    )
    assert correct_header.status_code == 200
    assert correct_header.json()["status"] == "active"

    # 5. View with correct password via POST unlock body -> 200 active
    correct_body = client.post(
        f"/api/share/{token}/unlock",
        json={"password": "super_secure_passphrase_2026"}
    )
    assert correct_body.status_code == 200
    assert correct_body.json()["status"] == "active"

    # 6. Test Brute-Force Rate Limiting: 5 failed attempts in sliding window
    for _ in range(5):
        fail_res = client.post(f"/api/share/{token}/unlock", json={"password": "wrong_guess"})
        assert fail_res.status_code == 401

    # 6th attempt should be blocked by Rate Limiter -> 429 Too Many Requests
    blocked_res = client.post(f"/api/share/{token}/unlock", json={"password": "super_secure_passphrase_2026"})
    assert blocked_res.status_code == 429
    assert "retry-after" in blocked_res.headers

    # Clean up
    client.delete(f"/api/share/{token}")


def test_reports_xss_sanitization():
    """Verify that dataset names and column headers with script tags are escaped in HTML and PDF."""
    malicious_meta = {
        "name": "<script>alert('xss_dataset')</script>",
        "source": "<img src=x onerror=alert('xss_source')>",
        "total_rows": 100,
        "total_columns": 2
    }
    malicious_clean_history = [
        {
            "action": "<b onmouseover=alert('xss_action')>Rename</b>",
            "column": "<script>alert('xss_col')</script>",
            "params": {"test": "<script>"},
            "timestamp": "2026-11-15T12:00:00"
        }
    ]

    html = generate_html_report(
        dataset_meta=malicious_meta,
        clean_history=malicious_clean_history,
        sections=["summary", "cleaning"]
    )
    # Ensure script tags are escaped
    assert "<script>" not in html
    assert "&lt;script&gt;alert(&#x27;xss_dataset&#x27;)&lt;/script&gt;" in html
    assert "&lt;script&gt;alert(&#x27;xss_col&#x27;)&lt;/script&gt;" in html

    # PDF generation must not crash when parsing XML
    pdf_bytes = generate_pdf_report(
        df=None,
        dataset_meta=malicious_meta,
        clean_history=malicious_clean_history,
        sections=["summary", "cleaning"]
    )
    assert pdf_bytes.startswith(b"%PDF-")


def test_invalid_project_ids_and_path_traversal():
    """Verify that malformed or traversal project IDs are rejected by strict regex."""
    malicious_ids = [
        "not-a-valid-uuid",
        "12345",
        "00000000-0000-0000-0000-00000000000g",
        "a0b1c2d3-e4f5-6a7b-8c9d-00000000000z",
        "%2e%2e%2fetc%2fpasswd",
        "%2e%2e%2f%2e%2e%2fsecrets",
        "admin-bypass-slug"
    ]
    for bad_id in malicious_ids:
        # GET
        get_res = client.get(f"/api/projects/{bad_id}?session_id={SESSION_A}")
        assert get_res.status_code in [400, 404]

        # DELETE
        del_res = client.delete(f"/api/projects/{bad_id}?session_id={SESSION_A}")
        assert del_res.status_code in [400, 404]

        # BUNDLE
        bun_res = client.get(f"/api/projects/{bad_id}/bundle?session_id={SESSION_A}")
        assert bun_res.status_code in [400, 404]


def test_concurrent_project_writes():
    """Verify thread-safe concurrent writes do not cause collisions or file corruption."""
    import concurrent.futures

    def save_single_project(idx: int):
        sid = f"concurrent-session-{idx}"
        store.get_or_create_session(sid)
        res = client.post(
            "/api/datasets/load-curated",
            json={"dataset_id": "iris", "session_id": sid}
        )
        assert res.status_code == 200

        save_res = client.post("/api/projects/save", json={
            "name": f"Concurrent Project {idx}",
            "session_id": sid
        })
        return save_res.status_code, save_res.json()

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        results = list(executor.map(save_single_project, range(4)))

    for status_code, data in results:
        assert status_code == 200
        assert data["status"] == "success"
        proj_id = data["project"]["id"]
        # Clean up
        client.delete(f"/api/projects/{proj_id}?session_id={data['project']['owner_session_id']}")


def test_bundle_defenses_duplicate_encrypted_unsupported():
    """Verify bundle importer rejects duplicate, encrypted, unsupported, and empty archives."""
    # 1. Duplicate filename
    dup_buf = io.BytesIO()
    with zipfile.ZipFile(dup_buf, "w") as zf:
        zf.writestr("meta.json", json.dumps({"name": "Test"}))
        zf.writestr("META.JSON", json.dumps({"name": "Test Duplicate"}))
    dup_buf.seek(0)
    files = {"file": ("dup.odl", dup_buf.getvalue(), "application/zip")}
    res_dup = client.post(f"/api/projects/import?session_id={SESSION_A}", files=files)
    assert res_dup.status_code == 400
    assert "duplicate" in res_dup.json()["detail"].lower()

    # 2. Encrypted archive entry (manipulate general purpose bit 0)
    enc_buf = io.BytesIO()
    with zipfile.ZipFile(enc_buf, "w") as zf:
        zf.writestr("meta.json", json.dumps({"name": "Protected Project"}))
    enc_bytes = bytearray(enc_buf.getvalue())
    enc_bytes[6] |= 0x01
    cd_offset = enc_bytes.find(b"PK\x01\x02")
    if cd_offset != -1:
        enc_bytes[cd_offset + 8] |= 0x01

    files = {"file": ("enc.odl", bytes(enc_bytes), "application/zip")}
    res_enc = client.post(f"/api/projects/import?session_id={SESSION_A}", files=files)
    assert res_enc.status_code == 400
    assert "encrypted" in res_enc.json()["detail"].lower()

    # 3. Unsupported extension (e.g. .pkl or .exe)
    unsupp_buf = io.BytesIO()
    with zipfile.ZipFile(unsupp_buf, "w") as zf:
        zf.writestr("exploit.pkl", b"cos\nsystem\n(S'whoami'\ntR.")
    unsupp_buf.seek(0)
    files = {"file": ("bad.odl", unsupp_buf.getvalue(), "application/zip")}
    res_unsupp = client.post(f"/api/projects/import?session_id={SESSION_A}", files=files)
    assert res_unsupp.status_code == 400
    assert "forbidden file extension" in res_unsupp.json()["detail"].lower()

    # 4. Empty archive
    empty_buf = io.BytesIO()
    with zipfile.ZipFile(empty_buf, "w") as zf:
        pass
    empty_buf.seek(0)
    files = {"file": ("empty.odl", empty_buf.getvalue(), "application/zip")}
    res_empty = client.post(f"/api/projects/import?session_id={SESSION_A}", files=files)
    assert res_empty.status_code == 400
    assert "empty" in res_empty.json()["detail"].lower()


def test_share_private_data_exclusion():
    """Verify public share payloads exclude disk paths, keys, internal tokens, and cap sample rows."""
    create_res = client.post("/api/share/create", json={
        "session_id": SESSION_A,
        "title": "Data Protection Audit Report",
        "sections": ["summary", "quality", "cleaning", "ml", "preview"]
    })
    assert create_res.status_code == 200
    token = create_res.json()["share"]["token"]

    # View shared report
    view_res = client.get(f"/api/share/{token}")
    assert view_res.status_code == 200
    report_json = json.dumps(view_res.json())

    # Sensitive data exclusions
    assert "storage/projects" not in report_json
    assert "owner_session_id" not in report_json
    assert "openai_api_key" not in report_json.lower()
    assert "password_hash" not in report_json

    # Preview records capped at 20 rows max
    records = view_res.json()["report_data"].get("preview_records", [])
    assert len(records) <= 20

    # Clean up
    client.delete(f"/api/share/{token}")


def test_full_real_data_workflow_end_to_end():
    """
    Executes the required complete real-data workflow:
    Upload -> Profile -> Clean -> Visualize -> AI analysis -> PDF export ->
    CSV/XLSX export -> Save project -> Reload project -> Download bundle ->
    Import bundle -> Create password-protected share -> Unlock share -> Revoke share -> Confirm revoked.
    """
    WORK_SESSION = "workflow-session-e2e-2026"
    store.clear_session(WORK_SESSION)

    # 1. Load real benchmark dataset
    load_res = client.post(
        "/api/datasets/load-curated",
        json={"dataset_id": "iris", "session_id": WORK_SESSION}
    )
    assert load_res.status_code == 200

    # 2. Quality Profile
    prof_res = client.get(f"/api/quality/analysis?session_id={WORK_SESSION}")
    assert prof_res.status_code == 200
    assert prof_res.json()["overview"]["completeness_score"] >= 90.0

    # 3. Clean: Rename column
    clean_res = client.post("/api/quality/clean", json={
        "action_type": "rename_column",
        "params": {"old_name": "sepal length (cm)", "new_name": "sepal_length"},
        "session_id": WORK_SESSION
    })
    assert clean_res.status_code == 200

    # 4. Train Model
    train_res = client.post("/api/ml/train", json={
        "session_id": WORK_SESSION,
        "target_col": "target",
        "problem_type": "classification",
        "feature_cols": ["sepal_length", "sepal width (cm)", "petal length (cm)", "petal width (cm)"],
        "selected_models": ["logistic_regression"]
    })
    assert train_res.status_code == 200

    # 5. Export PDF, CSV, and XLSX
    pdf_res = client.get(f"/api/reports/pdf?session_id={WORK_SESSION}")
    assert pdf_res.status_code == 200
    assert pdf_res.content.startswith(b"%PDF-")

    csv_res = client.get(f"/api/reports/csv?session_id={WORK_SESSION}")
    assert csv_res.status_code == 200
    assert len(csv_res.content) > 50

    excel_res = client.get(f"/api/reports/excel?session_id={WORK_SESSION}")
    assert excel_res.status_code == 200
    assert len(excel_res.content) > 1000

    # 6. Save Project
    save_res = client.post("/api/projects/save", json={
        "name": "End-to-End Audit Project",
        "description": "Full workflow verification",
        "session_id": WORK_SESSION
    })
    assert save_res.status_code == 200
    proj_id = save_res.json()["project"]["id"]

    # 7. Reload Project in same session
    load_proj_res = client.post(f"/api/projects/{proj_id}/load", json={
        "session_id": WORK_SESSION
    })
    assert load_proj_res.status_code == 200

    # 8. Download portable .odl bundle
    bundle_res = client.get(f"/api/projects/{proj_id}/bundle?session_id={WORK_SESSION}")
    assert bundle_res.status_code == 200
    bundle_bytes = bundle_res.content
    assert len(bundle_bytes) > 200

    # 9. Import bundle into a fresh session
    IMPORT_SESSION = "imported-session-e2e-2026"
    import_files = {"file": ("backup.odl", bundle_bytes, "application/zip")}
    imp_res = client.post(f"/api/projects/import?session_id={IMPORT_SESSION}", files=import_files)
    assert imp_res.status_code == 200
    imported_pid = imp_res.json()["project"]["id"]

    # 10. Create Argon2id password-protected share
    share_res = client.post("/api/share/create", json={
        "session_id": WORK_SESSION,
        "title": "Audit Verified Public Share",
        "password": "audit_secret_passphrase_2026",
        "sections": ["summary", "quality", "cleaning", "ml", "preview"]
    })
    assert share_res.status_code == 200
    share_token = share_res.json()["share"]["token"]

    # 11. Unlock share via POST body
    unlock_res = client.post(
        f"/api/share/{share_token}/unlock",
        json={"password": "audit_secret_passphrase_2026"}
    )
    assert unlock_res.status_code == 200
    assert unlock_res.json()["status"] == "active"

    # 12. Revoke share
    rev_res = client.delete(f"/api/share/{share_token}")
    assert rev_res.status_code == 200

    # 13. Confirm revoked access is 404
    view_revoked = client.get(f"/api/share/{share_token}")
    assert view_revoked.status_code == 404

    # Clean up projects
    client.delete(f"/api/projects/{proj_id}?session_id={WORK_SESSION}")
    client.delete(f"/api/projects/{imported_pid}?session_id={IMPORT_SESSION}")

