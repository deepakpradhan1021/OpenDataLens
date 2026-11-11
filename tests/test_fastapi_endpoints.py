"""
FastAPI Endpoint and Integration Tests for OpenDataLens.
"""

import time
import io
import pytest
from fastapi.testclient import TestClient

from backend.api.main import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["version"] == "1.0.0"


def test_curated_datasets_list():
    response = client.get("/api/datasets/curated")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 5
    ids = [d["id"] for d in data]
    assert "iris" in ids
    assert "california_housing" in ids


def test_load_curated_and_get_active():
    session_id = "test_session_1"
    # Load Iris
    load_resp = client.post("/api/datasets/load-curated", json={"dataset_id": "iris", "session_id": session_id})
    assert load_resp.status_code == 200
    load_data = load_resp.json()
    assert load_data["total_rows"] == 150
    assert load_data["total_cols"] == 5
    assert len(load_data["records"]) > 0

    # Verify active
    active_resp = client.get(f"/api/datasets/active?session_id={session_id}")
    assert active_resp.status_code == 200
    active_data = active_resp.json()
    assert active_data["total_rows"] == 150


def test_quality_analysis_and_distribution():
    session_id = "test_session_2"
    client.post("/api/datasets/load-curated", json={"dataset_id": "iris", "session_id": session_id})

    # Quality analysis
    q_resp = client.get(f"/api/quality/analysis?session_id={session_id}")
    assert q_resp.status_code == 200
    q_data = q_resp.json()
    assert q_data["overview"]["completeness_score"] == 100.0
    assert "recommendations" in q_data
    assert len(q_data["recommendations"]) > 0

    # Numeric Distribution
    first_col = list(q_data["numeric_stats"].keys())[0]
    dist_resp = client.get(f"/api/quality/distribution?column={first_col}&session_id={session_id}")
    assert dist_resp.status_code == 200
    dist_data = dist_resp.json()
    assert dist_data["type"] == "numeric"
    assert "bins" in dist_data
    assert len(dist_data["bins"]) > 0


def test_ml_training_job_and_evaluation():
    session_id = "test_session_ml"
    client.post("/api/datasets/load-curated", json={"dataset_id": "iris", "session_id": session_id})

    # Target candidates
    cand_resp = client.get(f"/api/ml/target-candidates?session_id={session_id}")
    assert cand_resp.status_code == 200
    cand_data = cand_resp.json()
    assert "target" in cand_data["classification"]

    # Start training
    train_payload = {
        "session_id": session_id,
        "problem_type": "classification",
        "target_col": "target",
        "feature_cols": ["sepal length (cm)", "sepal width (cm)", "petal length (cm)", "petal width (cm)"],
        "selected_models": ["logistic_regression", "decision_tree"],
        "scaler_type": "standard",
        "test_size": 0.2,
        "random_state": 42
    }
    train_resp = client.post("/api/ml/train", json=train_payload)
    assert train_resp.status_code == 200
    job_info = train_resp.json()
    job_id = job_info["job_id"]
    assert job_info["status"] == "running"

    # Poll status until completed (timeout 10s)
    for _ in range(20):
        status_resp = client.get(f"/api/ml/train/status/{job_id}")
        assert status_resp.status_code == 200
        st_data = status_resp.json()
        if st_data["status"] == "completed":
            break
        elif st_data["status"] == "failed":
            pytest.fail(f"Training job failed: {st_data['error']}")
        time.sleep(0.3)
    else:
        pytest.fail("Training job timed out.")

    # Model comparison
    comp_resp = client.get(f"/api/evaluation/comparison?session_id={session_id}")
    assert comp_resp.status_code == 200
    comp_data = comp_resp.json()
    assert "champion" in comp_data
    assert len(comp_data["scoreboard"]) == 2

    # Diagnostics
    diag_resp = client.get(f"/api/evaluation/diagnostics/logistic_regression?session_id={session_id}")
    assert diag_resp.status_code == 200
    diag_data = diag_resp.json()
    assert "confusion_matrix" in diag_data

    # Download HTML report
    html_resp = client.get(f"/api/reports/html?session_id={session_id}")
    assert html_resp.status_code == 200
    assert "OpenDataLens" in html_resp.text

    # Download Joblib model
    joblib_resp = client.get(f"/api/reports/model/logistic_regression?session_id={session_id}")
    assert joblib_resp.status_code == 200
    assert len(joblib_resp.content) > 0


def test_upload_csv_endpoint():
    session_id = "test_upload"
    csv_bytes = b"col1,col2,target\n1,10.5,0\n2,20.5,1\n3,30.5,0\n4,40.5,1\n"
    files = {"file": ("test.csv", io.BytesIO(csv_bytes), "text/csv")}
    resp = client.post("/api/datasets/upload-csv", files=files, data={"session_id": session_id})
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_rows"] == 4
    assert data["total_cols"] == 3


def test_target_leakage_rejection():
    session_id = "test_leakage_session"
    load_resp = client.post("/api/datasets/load-curated", json={"dataset_id": "iris", "session_id": session_id})
    assert load_resp.status_code == 200

    # Including target column in feature_cols must be rejected with 400
    leak_req = {
        "session_id": session_id,
        "problem_type": "classification",
        "target_col": "target",
        "feature_cols": ["sepal length (cm)", "target"],  # LEAKAGE
        "selected_models": ["logistic_regression"],
        "scaler_type": "standard",
        "test_size": 0.2
    }
    resp = client.post("/api/ml/train", json=leak_req)
    assert resp.status_code == 400
    assert "target leakage" in resp.json()["detail"].lower()


def test_invalid_feature_columns_rejection():
    session_id = "test_invalid_feats"
    client.post("/api/datasets/load-curated", json={"dataset_id": "iris", "session_id": session_id})

    req = {
        "session_id": session_id,
        "problem_type": "classification",
        "target_col": "target",
        "feature_cols": ["non_existent_column_123"],
        "selected_models": ["logistic_regression"],
        "scaler_type": "standard",
        "test_size": 0.2
    }
    resp = client.post("/api/ml/train", json=req)
    assert resp.status_code == 400
    assert "do not exist" in resp.json()["detail"].lower()


def test_invalid_model_type_rejection():
    session_id = "test_invalid_model"
    client.post("/api/datasets/load-curated", json={"dataset_id": "iris", "session_id": session_id})

    req = {
        "session_id": session_id,
        "problem_type": "classification",
        "target_col": "target",
        "feature_cols": ["sepal length (cm)"],
        "selected_models": ["super_deep_transformer_unknown"],
        "scaler_type": "standard",
        "test_size": 0.2
    }
    resp = client.post("/api/ml/train", json=req)
    assert resp.status_code == 400
    assert "invalid model architectures" in resp.json()["detail"].lower()


def test_job_ownership_access_denied():
    session_owner = "owner_workspace_1"
    session_intruder = "intruder_workspace_2"
    client.post("/api/datasets/load-curated", json={"dataset_id": "iris", "session_id": session_owner})

    train_req = {
        "session_id": session_owner,
        "problem_type": "classification",
        "target_col": "target",
        "feature_cols": ["sepal length (cm)", "sepal width (cm)"],
        "selected_models": ["logistic_regression"],
        "scaler_type": "standard",
        "test_size": 0.2
    }
    train_resp = client.post("/api/ml/train", json=train_req)
    assert train_resp.status_code == 200
    job_id = train_resp.json()["job_id"]

    # Owner can poll with own session ID
    owner_poll = client.get(f"/api/ml/train/status/{job_id}", headers={"X-Session-ID": session_owner})
    assert owner_poll.status_code == 200

    # Intruder polling with different session ID must receive 403 Forbidden
    intruder_poll = client.get(f"/api/ml/train/status/{job_id}", headers={"X-Session-ID": session_intruder})
    assert intruder_poll.status_code == 403
    assert "access denied" in intruder_poll.json()["detail"].lower()
