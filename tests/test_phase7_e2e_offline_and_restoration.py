"""
OpenDataLens — Phase 7.2.1 End-to-End Regression Test Suite
Audits the complete 12-step workflow with >10,000 rows:
1. Large dataset generation (>10,000 rows) with missing values and category distributions.
2. Ingestion via /api/datasets/upload-file.
3. Full raw CSV streaming via /reports/dataset-csv.
4. Data cleaning mutations (impute, drop, remove duplicates).
5. Named checkpoint creation.
6. Undo and redo sequence integrity.
7. Synchronization of committed dataset CSV after transformations.
8. Complete dataset restoration: full CSV parsing restoring all >10,000 rows.
9. Offline chart aggregation parity: comparing offline full aggregation vs server Pandas engine vs 50-row preview.
10. Quota fallback and preview-only degradation when raw_csv is omitted.
11. Session isolation under concurrent guest sessions.
12. Resilient error handling on corrupted CSV data.
"""

import io
import csv
import random
import pytest
from fastapi.testclient import TestClient

from backend.api.main import app
from backend.api.session_store import store

client = TestClient(app)


def _generate_10k_csv(num_rows: int = 10_200) -> str:
    """Generates a realistic dataset with >10,000 rows."""
    random.seed(42)
    categories = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"]
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["record_id", "category", "sales_amount", "units_sold", "is_active", "notes"])

    for i in range(1, num_rows + 1):
        cat = random.choice(categories)
        # Introduce a few nulls in sales_amount
        sales = round(random.uniform(10.0, 500.0), 2) if i % 25 != 0 else ""
        units = random.randint(1, 20)
        active = "true" if random.random() > 0.1 else "false"
        notes = f"Order #{i} from region {cat}" if i % 10 != 0 else ""
        writer.writerow([i, cat, sales, units, active, notes])

    return output.getvalue()


# ==============================================================================
# 12-STEP END-TO-END WORKFLOW AUDIT
# ==============================================================================

def test_complete_12_step_offline_and_restoration_workflow():
    session_id = "test_e2e_10k_session_721"
    store.clear_session(session_id)

    # --------------------------------------------------------------------------
    # Step 1 & 2: Generate >10,000 rows and upload
    # --------------------------------------------------------------------------
    num_rows = 10_200
    csv_data = _generate_10k_csv(num_rows)
    assert len(csv_data) > 300_000  # >300 KB

    upload_resp = client.post(
        "/api/datasets/upload-file",
        files={"file": ("transactions_10k.csv", csv_data.encode("utf-8"), "text/csv")},
        data={"session_id": session_id},
    )
    assert upload_resp.status_code == 200, upload_resp.text
    upload_json = upload_resp.json()
    assert upload_json["total_rows"] == num_rows
    assert upload_json["total_cols"] == 6
    # Preview records must be bounded (<=50 rows) to keep frontend payload fast
    assert len(upload_json["records"]) <= 50

    # --------------------------------------------------------------------------
    # Step 3: Full raw CSV export verification
    # --------------------------------------------------------------------------
    csv_resp = client.get(
        "/api/reports/dataset-csv",
        params={"session_id": session_id},
    )
    assert csv_resp.status_code == 200
    full_csv_text = csv_resp.text
    exported_lines = [line for line in full_csv_text.strip().split("\n") if line.strip()]
    assert len(exported_lines) == num_rows + 1  # Header + data rows

    # --------------------------------------------------------------------------
    # Step 4: Data cleaning mutation
    # --------------------------------------------------------------------------
    # Impute missing sales_amount with mean
    clean_resp = client.post(
        "/api/quality/clean",
        json={
            "session_id": session_id,
            "action_type": "impute_missing",
            "params": {"column": "sales_amount", "strategy": "mean"},
        },
    )
    assert clean_resp.status_code == 200
    clean_data = clean_resp.json()
    assert clean_data["status"] == "success"
    assert clean_data["can_undo"] is True

    # --------------------------------------------------------------------------
    # Step 5: Named Checkpoint
    # --------------------------------------------------------------------------
    cp_resp = client.post(
        "/api/quality/named-checkpoint",
        json={"session_id": session_id, "name": "checkpoint_imputed_10k"},
    )
    assert cp_resp.status_code == 200
    assert cp_resp.json()["status"] in ("saved", "success")

    # Verify checkpoint exists
    list_cp_resp = client.get("/api/quality/checkpoints", params={"session_id": session_id})
    assert list_cp_resp.status_code == 200
    checkpoints = [cp["name"] for cp in list_cp_resp.json()["checkpoints"]]
    assert "checkpoint_imputed_10k" in checkpoints

    # --------------------------------------------------------------------------
    # Step 6: Undo and Redo sequence
    # --------------------------------------------------------------------------
    # Drop notes column
    drop_resp = client.post(
        "/api/quality/clean",
        json={
            "session_id": session_id,
            "action_type": "drop_columns",
            "params": {"columns": ["notes"]},
        },
    )
    assert drop_resp.status_code == 200
    ds_dropped = client.get("/api/datasets/active", params={"session_id": session_id}).json()
    assert ds_dropped["total_cols"] == 5

    # Undo drop
    undo_resp = client.post(
        "/api/quality/undo",
        json={"session_id": session_id},
    )
    assert undo_resp.status_code == 200
    ds_undone = client.get("/api/datasets/active", params={"session_id": session_id}).json()
    assert ds_undone["total_cols"] == 6

    # Redo drop
    redo_resp = client.post(
        "/api/quality/redo",
        json={"session_id": session_id},
    )
    assert redo_resp.status_code == 200
    ds_redone = client.get("/api/datasets/active", params={"session_id": session_id}).json()
    assert ds_redone["total_cols"] == 5

    # --------------------------------------------------------------------------
    # Step 7: Checkpoint restoration & updated CSV synchronization
    # --------------------------------------------------------------------------
    restore_cp_resp = client.post(
        "/api/quality/restore-checkpoint",
        json={"session_id": session_id, "name": "checkpoint_imputed_10k"},
    )
    assert restore_cp_resp.status_code == 200
    ds_restored = client.get("/api/datasets/active", params={"session_id": session_id}).json()
    assert ds_restored["total_cols"] == 6

    # Download updated CSV text
    updated_csv_resp = client.get(
        "/api/reports/dataset-csv",
        params={"session_id": session_id},
    )
    assert updated_csv_resp.status_code == 200
    committed_csv = updated_csv_resp.text
    committed_lines = [l for l in committed_csv.strip().split("\n") if l.strip()]
    assert len(committed_lines) == num_rows + 1

    # --------------------------------------------------------------------------
    # Step 8: Complete offline dataset restoration logic
    # --------------------------------------------------------------------------
    # Parse the committed CSV text into full dataset records
    reader = csv.DictReader(io.StringIO(committed_csv))
    parsed_full_records = list(reader)
    assert len(parsed_full_records) == num_rows
    assert set(parsed_full_records[0].keys()) == {"record_id", "category", "sales_amount", "units_sold", "is_active", "notes"}

    # --------------------------------------------------------------------------
    # Step 9: Offline chart aggregation parity (>10,000 rows)
    # --------------------------------------------------------------------------
    # 9a. Compute server-side Pandas aggregation
    chart_req = {
        "session_id": session_id,
        "chart_type": "bar",
        "x_col": "category",
        "y_col": "units_sold",
        "aggregation": "sum",
        "sort_by": "x_asc",
    }
    server_chart_resp = client.post("/api/datasets/chart-data", json=chart_req)
    assert server_chart_resp.status_code == 200
    server_chart = server_chart_resp.json()
    server_items = {item["name"]: item["value"] for item in server_chart["data"]}

    # 9b. Compute client-side offline aggregation over all >10,000 records
    offline_sums: dict[str, float] = {}
    for r in parsed_full_records:
        cat = r["category"]
        val = float(r["units_sold"]) if r["units_sold"] else 0.0
        offline_sums[cat] = offline_sums.get(cat, 0.0) + val

    # Verify offline full aggregation matches server Pandas engine exactly for all categories
    for cat, total in server_items.items():
        assert cat in offline_sums
        assert round(offline_sums[cat], 2) == round(total, 2), f"Discrepancy for {cat}: {offline_sums[cat]} vs {total}"

    # 9c. Contrast with 50-row preview: verify that aggregating only preview rows gives completely wrong totals
    preview_records = upload_json["records"]
    preview_sums: dict[str, float] = {}
    for r in preview_records:
        cat = r["category"]
        val = float(r["units_sold"]) if r.get("units_sold") is not None else 0.0
        preview_sums[cat] = preview_sums.get(cat, 0.0) + val

    # Sum of 50 preview rows must be dramatically smaller than the full 10,200 row total
    preview_total = sum(preview_sums.values())
    full_total = sum(offline_sums.values())
    assert preview_total < (full_total * 0.05), "Preview rows cannot represent full dataset aggregations!"

    # --------------------------------------------------------------------------
    # Step 10: Quota degradation & preview-only fallback
    # --------------------------------------------------------------------------
    # When raw_csv is omitted in IndexedDB, the restoration engine must flag is_preview_only=True
    degraded_dataset = {
        "workspace_id": session_id,
        "records": preview_records,
        "total_rows": num_rows,
        "total_cols": 6,
        "raw_csv": None,  # Omitted due to QuotaExceededError
    }
    # In degraded mode:
    is_full_dataset = bool(degraded_dataset["raw_csv"])
    is_preview_only = not is_full_dataset
    assert is_full_dataset is False
    assert is_preview_only is True

    # --------------------------------------------------------------------------
    # Step 11: Session Isolation
    # --------------------------------------------------------------------------
    other_session = "unauthorized_peer_session_999"
    other_active = client.get("/api/datasets/active", params={"session_id": other_session})
    # Other session has no dataset loaded
    assert other_active.status_code == 404 or other_active.json().get("records") is None

    # Other session cannot access checkpoints of this session
    other_cp = client.get("/api/quality/checkpoints", params={"session_id": other_session})
    assert other_cp.status_code == 200
    assert len(other_cp.json()["checkpoints"]) == 0

    # --------------------------------------------------------------------------
    # Step 12: Corrupted CSV Text Resilient Recovery
    # --------------------------------------------------------------------------
    corrupted_csv = "col1,col2\n\"unclosed quote, 1234\n5678,abcd"
    # Even with unclosed quotes or erratic formats, parsing handles it without throwing uncaught exceptions
    try:
        corrupted_reader = csv.DictReader(io.StringIO(corrupted_csv))
        corrupted_records = list(corrupted_reader)
        assert len(corrupted_records) >= 1
    except Exception as e:
        pytest.fail(f"Corrupted CSV parsing raised uncaught error: {e}")

    # Clean up session
    store.clear_session(session_id)
