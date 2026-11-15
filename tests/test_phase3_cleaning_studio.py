"""
Phase 3 Tests: Interactive Data Cleaning & Visualization Studio.
Tests sorting, normalization, outlier removal, dry-run previews,
named checkpoints, and full pipeline synchronization.
"""

import pytest
import pandas as pd
import numpy as np
from fastapi.testclient import TestClient

from backend.api.main import app
from backend.api.session_store import store
from core.cleaner import (
    sort_rows,
    normalize_column,
    remove_outliers,
    preview_cleaning_action,
    apply_cleaning_action
)

client = TestClient(app)


@pytest.fixture
def sample_numeric_df():
    np.random.seed(42)
    return pd.DataFrame({
        "id": range(1, 101),
        "val": np.random.normal(50, 10, 100),
        "category": np.random.choice(["Alpha", "Beta", "Gamma"], 100)
    })


def test_sort_rows_ascending_and_descending(sample_numeric_df):
    df_asc, msg_asc = sort_rows(sample_numeric_df, "val", ascending=True)
    assert df_asc["val"].is_monotonic_increasing
    assert "ascending" in msg_asc
    assert len(df_asc) == 100

    df_desc, msg_desc = sort_rows(sample_numeric_df, "val", ascending=False)
    assert df_desc["val"].is_monotonic_decreasing
    assert "descending" in msg_desc
    assert len(df_desc) == 100


def test_sort_rows_invalid_column(sample_numeric_df):
    with pytest.raises(ValueError, match="does not exist"):
        sort_rows(sample_numeric_df, "nonexistent")


def test_normalize_column_minmax(sample_numeric_df):
    df_norm, msg = normalize_column(sample_numeric_df, "val", method="minmax")
    assert df_norm["val"].min() == 0.0
    assert df_norm["val"].max() == 1.0
    assert "Min-Max" in msg


def test_normalize_column_zscore(sample_numeric_df):
    df_norm, msg = normalize_column(sample_numeric_df, "val", method="zscore")
    assert pytest.approx(df_norm["val"].mean(), abs=1e-3) == 0.0
    assert pytest.approx(df_norm["val"].std(ddof=0), abs=1e-3) == 1.0
    assert "Z-score" in msg


def test_normalize_column_robust(sample_numeric_df):
    df_norm, msg = normalize_column(sample_numeric_df, "val", method="robust")
    assert pytest.approx(df_norm["val"].median(), abs=1e-3) == 0.0
    assert "Robust-scaled" in msg


def test_normalize_column_constant_edge_case():
    df = pd.DataFrame({"const": [10.0, 10.0, 10.0]})
    df_norm, msg = normalize_column(df, "const", method="minmax")
    assert (df_norm["const"] == 0.0).all()

    df_z, _ = normalize_column(df, "const", method="zscore")
    assert (df_z["const"] == 0.0).all()


def test_normalize_column_non_numeric(sample_numeric_df):
    with pytest.raises(ValueError, match="is not numeric"):
        normalize_column(sample_numeric_df, "category", method="minmax")


def test_remove_outliers_iqr():
    df = pd.DataFrame({"x": [10, 11, 12, 11, 10, 12, 11, 100, -50]})
    df_clean, msg = remove_outliers(df, "x", method="iqr", threshold=1.5)
    assert len(df_clean) == 7
    assert 100 not in df_clean["x"].values
    assert -50 not in df_clean["x"].values
    assert "Removed 2 outlier rows" in msg


def test_remove_outliers_zscore():
    df = pd.DataFrame({"x": [10, 11, 12, 11, 10, 12, 11, 100]})
    df_clean, msg = remove_outliers(df, "x", method="zscore", threshold=2.0)
    assert len(df_clean) < len(df)
    assert 100 not in df_clean["x"].values


def test_remove_outliers_all_eliminated_error():
    df = pd.DataFrame({"x": [1000, -1000]})
    with pytest.raises(ValueError, match="would eliminate all"):
        remove_outliers(df, "x", method="zscore", threshold=0.1)


def test_preview_cleaning_action_dry_run(sample_numeric_df):
    original_val_mean = sample_numeric_df["val"].mean()
    preview = preview_cleaning_action(sample_numeric_df, "normalize", {"column": "val", "method": "minmax"})

    assert preview["status"] == "preview"
    assert preview["rows_before"] == 100
    assert preview["rows_after"] == 100
    assert preview["stats_before"]["min"] is not None
    assert preview["stats_after"]["min"] == 0.0
    assert preview["stats_after"]["max"] == 1.0

    # Assert original dataframe was untouched
    assert sample_numeric_df["val"].mean() == original_val_mean


def test_named_checkpoints_lifecycle():
    sid = "test-checkpoints-lifecycle"
    df = pd.DataFrame({"a": [1, 2, 3], "b": [10, 20, 30]})
    store.set_dataset(sid, df, {"name": "test_ds"})

    # 1. Save checkpoint
    cp = store.create_named_checkpoint(sid, "Initial Base")
    assert cp["name"] == "Initial Base"
    assert cp["rows"] == 3

    # 2. Modify dataset
    mod_df = pd.DataFrame({"a": [100, 200], "b": [1000, 2000]})
    store.push_checkpoint(sid, mod_df, "Applied heavy filter")
    assert store.get_dataset(sid).shape[0] == 2

    # 3. List checkpoints
    cps = store.list_named_checkpoints(sid)
    assert len(cps) == 1
    assert cps[0]["name"] == "Initial Base"

    # 4. Restore checkpoint
    restored = store.restore_named_checkpoint(sid, "Initial Base")
    assert restored["rows"] == 3
    curr_df = store.get_dataset(sid)
    assert len(curr_df) == 3
    assert curr_df["a"].tolist() == [1, 2, 3]

    # 5. Check undo works after restore
    undo_res = store.undo_checkpoint(sid)
    assert undo_res is not None
    assert undo_res["rows"] == 2

    # 6. Delete checkpoint
    assert store.delete_named_checkpoint(sid, "Initial Base") is True
    assert len(store.list_named_checkpoints(sid)) == 0


def test_api_preview_clean_endpoint():
    sid = "test-preview-api"
    # Load curated dataset
    resp = client.post("/api/datasets/load-curated", json={"dataset_id": "iris", "session_id": sid})
    assert resp.status_code == 200

    # Preview normalize
    prev_resp = client.post("/api/quality/preview-clean", json={
        "session_id": sid,
        "action_type": "normalize",
        "params": {"column": "sepal length (cm)", "method": "minmax"}
    })
    assert prev_resp.status_code == 200
    pdata = prev_resp.json()
    assert pdata["status"] == "preview"
    assert pdata["rows_before"] == 150
    assert pdata["rows_after"] == 150
    assert pdata["stats_after"]["min"] == 0.0
    assert pdata["stats_after"]["max"] == 1.0


def test_api_named_checkpoints_endpoints():
    sid = "test-checkpoints-api"
    client.post("/api/datasets/load-curated", json={"dataset_id": "iris", "session_id": sid})

    # 1. Create checkpoint
    res = client.post("/api/quality/named-checkpoint", json={"session_id": sid, "name": "Raw Iris"})
    assert res.status_code == 200
    assert res.json()["status"] == "success"

    # 2. List checkpoints
    list_res = client.get("/api/quality/checkpoints", params={"session_id": sid})
    assert list_res.status_code == 200
    assert list_res.json()["count"] == 1
    assert list_res.json()["checkpoints"][0]["name"] == "Raw Iris"

    # 3. Clean dataset
    clean_res = client.post("/api/quality/clean", json={
        "session_id": sid,
        "action_type": "filter_rows",
        "params": {"column": "sepal length (cm)", "operator": ">", "value": 5.0}
    })
    assert clean_res.status_code == 200
    assert clean_res.json()["rows"] < 150

    # 4. Restore checkpoint
    rest_res = client.post("/api/quality/restore-checkpoint", json={"session_id": sid, "name": "Raw Iris"})
    assert rest_res.status_code == 200
    assert rest_res.json()["rows"] == 150

    # 5. Delete checkpoint
    del_res = client.delete(f"/api/quality/checkpoints/Raw Iris?session_id={sid}")
    assert del_res.status_code == 200
    assert client.get("/api/quality/checkpoints", params={"session_id": sid}).json()["count"] == 0


def test_ml_studio_compatibility_after_cleaning():
    sid = "test-ml-compat-clean"
    # Load dataset
    client.post("/api/datasets/load-curated", json={"dataset_id": "iris", "session_id": sid})

    # Normalize a feature
    client.post("/api/quality/clean", json={
        "session_id": sid,
        "action_type": "normalize",
        "params": {"column": "sepal length (cm)", "method": "minmax"}
    })

    # Train classification models
    train_resp = client.post("/api/ml/train", json={
        "session_id": sid,
        "problem_type": "classification",
        "target_col": "target",
        "feature_cols": ["sepal length (cm)", "sepal width (cm)", "petal length (cm)", "petal width (cm)"],
        "selected_models": ["logistic_regression", "random_forest"],
        "scaler_type": "standard",
        "test_size": 0.2,
        "random_state": 42,
        "cv_folds": 3
    })
    assert train_resp.status_code == 200
    job_id = train_resp.json()["job_id"]

    # Poll status
    import time
    for _ in range(10):
        status_resp = client.get(f"/api/ml/train/status/{job_id}", params={"session_id": sid})
        if status_resp.status_code == 200 and status_resp.json()["status"] in ["completed", "failed"]:
            break
        time.sleep(0.5)

    assert status_resp.json()["status"] == "completed"
    comp_resp = client.get("/api/evaluation/comparison", params={"session_id": sid})
    assert comp_resp.status_code == 200
    assert len(comp_resp.json()["scoreboard"]) == 2
