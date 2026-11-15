"""
Unit and Integration Tests for OpenDataLens Visualization Intelligence & Chart Engine.
Verifies mathematical correctness of Pandas aggregations, interval binning,
natural chronological ordering, and non-flat charts for California Housing.
"""

import pytest
import numpy as np
import pandas as pd
from sklearn.datasets import fetch_california_housing
from fastapi.testclient import TestClient

from core.chart_engine import compute_chart_data, detect_column_semantic_type
from backend.api.main import app
from backend.api.session_store import store


@pytest.fixture(scope="module")
def cal_housing_df():
    data = fetch_california_housing(as_frame=True)
    return data.frame


@pytest.fixture
def test_client():
    return TestClient(app)


def test_detect_column_semantic_type():
    df = pd.DataFrame({
        "num_continuous": [1.2, 3.4, 5.6, 7.8, 9.0, 11.2, 13.4, 15.6, 17.8, 19.0, 21.2, 23.4, 25.6, 27.8, 29.0, 31.2, 33.4],
        "num_discrete": [1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2],
        "cat_str": ["cat", "dog", "bird", "fish", "cat", "dog", "bird", "fish", "cat", "dog", "bird", "fish", "cat", "dog", "bird", "fish", "cat"],
        "date_str": ["2023-01-01", "2023-01-02", "2023-01-03", "2023-01-04", "2023-01-05", "2023-01-06", "2023-01-07", "2023-01-08", "2023-01-09", "2023-01-10", "2023-01-11", "2023-01-12", "2023-01-13", "2023-01-14", "2023-01-15", "2023-01-16", "2023-01-17"]
    })

    assert detect_column_semantic_type(df["num_continuous"]) == "continuous_numeric"
    assert detect_column_semantic_type(df["num_discrete"]) == "discrete_numeric"
    assert detect_column_semantic_type(df["cat_str"]) == "categorical"
    assert detect_column_semantic_type(df["date_str"]) == "datetime"


def test_california_housing_no_flat_line_chart(cal_housing_df):
    """
    Root Cause Verification:
    In California Housing, previously MedInc vs HouseAge resulted in 15 identical bars
    and a completely flat line chart at y=52.0 due to unbinned grouping + sorting by Y descending.
    With proper interval binning, values must vary dynamically and NOT be flat.
    """
    res = compute_chart_data(
        df=cal_housing_df,
        chart_type="line",
        x_col="MedInc",
        y_col="HouseAge",
        aggregation="mean",
        bins=10,
        bin_numeric=True,
        sort_by="auto"
    )

    data = res["data"]
    assert len(data) == 10
    values = [item["value"] for item in data]

    # Verify that values are NOT flat / identical
    unique_vals = set(values)
    assert len(unique_vals) > 1, f"Values should not be identical: {values}"

    # Verify values match expected pandas groupby cut
    cuts = pd.cut(cal_housing_df["MedInc"], bins=10)
    expected_means = cal_housing_df.groupby(cuts, observed=False)["HouseAge"].mean().round(2).tolist()
    assert values == expected_means

    # Verify HouseAge is not all 52.0
    assert not all(v == 52.0 for v in values)
    assert res["insights"]["is_constant"] is False


def test_california_housing_medinc_vs_medhouseval_correlation(cal_housing_df):
    """
    Verify that higher income predicts higher home values (r ~ +0.688).
    """
    res = compute_chart_data(
        df=cal_housing_df,
        chart_type="bar",
        x_col="MedInc",
        y_col="MedHouseVal",
        aggregation="mean",
        bins=10,
        bin_numeric=True,
        sort_by="auto"
    )

    data = res["data"]
    assert len(data) == 10
    # Values should climb steadily across income intervals
    first_half_avg = sum(d["value"] for d in data[:5]) / 5
    second_half_avg = sum(d["value"] for d in data[5:]) / 5
    assert second_half_avg > first_half_avg

    corr = res["insights"]["correlation"]
    assert corr > 0.65
    assert "upward" in res["insights"]["summary_text"].lower() or "positive" in res["insights"]["summary_text"].lower()


def test_chronological_ordering_for_dates():
    """
    Verify that datetime X-axis data is sorted chronologically, NOT by Y descending.
    """
    df = pd.DataFrame({
        "date": ["2023-05-01", "2023-01-01", "2023-03-01", "2023-02-01", "2023-04-01"],
        "metric": [50.0, 10.0, 30.0, 20.0, 40.0]
    })

    res = compute_chart_data(
        df=df,
        chart_type="line",
        x_col="date",
        y_col="metric",
        aggregation="mean",
        sort_by="auto"
    )

    data = res["data"]
    labels = [d["name"] for d in data]
    values = [d["value"] for d in data]

    # Verify chronological order
    assert labels == ["2023-01-01", "2023-02-01", "2023-03-01", "2023-04-01", "2023-05-01"]
    assert values == [10.0, 20.0, 30.0, 40.0, 50.0]
    assert res["insights"]["trend_type"] == "chronological"
    assert res["insights"]["growth_rate"] == 400.0


def test_scatter_plot_real_pairs():
    """
    Scatter plot must preserve actual (x, y) pairs without collapsing into groups.
    """
    np.random.seed(42)
    x = np.linspace(1, 100, 50)
    y = 2.5 * x + np.random.normal(0, 5, 50)
    df = pd.DataFrame({"feature_x": x, "target_y": y})

    res = compute_chart_data(
        df=df,
        chart_type="scatter",
        x_col="feature_x",
        y_col="target_y"
    )

    data = res["data"]
    assert len(data) == 50
    assert data[0]["x"] == 1.0
    corr = res["insights"]["correlation"]
    assert corr > 0.95


def test_histogram_numpy_parity():
    """
    Histogram bin counts must exactly match numpy.histogram.
    """
    np.random.seed(42)
    vals = np.random.normal(50, 15, 200)
    df = pd.DataFrame({"score": vals})

    res = compute_chart_data(
        df=df,
        chart_type="histogram",
        x_col="score",
        bins=10
    )

    np_counts, np_edges = np.histogram(vals, bins=10)
    engine_counts = [d["count"] for d in res["data"]]
    assert engine_counts == np_counts.tolist()


def test_heatmap_correlation_matrix():
    df = pd.DataFrame({
        "a": [1, 2, 3, 4, 5],
        "b": [2, 4, 6, 8, 10],
        "c": [5, 4, 3, 2, 1]
    })

    res = compute_chart_data(
        df=df,
        chart_type="heatmap",
        x_col="a"
    )

    matrix = res["data"]["matrix"]
    assert matrix["a"]["b"] == 1.0
    assert matrix["a"]["c"] == -1.0


def test_constant_dataset_honest_detection():
    """
    When all values are uniform, engine must flag is_constant and state no variance detected.
    """
    df = pd.DataFrame({
        "group": ["A", "B", "C", "D"],
        "flat_val": [52.0, 52.0, 52.0, 52.0]
    })

    res = compute_chart_data(
        df=df,
        chart_type="bar",
        x_col="group",
        y_col="flat_val"
    )

    assert res["insights"]["is_constant"] is True
    assert res["insights"]["trend_type"] == "constant"
    assert "uniform" in res["insights"]["summary_text"].lower()


def test_api_chart_data_endpoint(test_client):
    """
    Verify POST /api/datasets/chart-data route through FastAPI TestClient.
    """
    # Load curated dataset into a test session
    session_id = "test_viz_session"
    load_res = test_client.post("/api/datasets/load-curated", json={"dataset_id": "california_housing", "session_id": session_id})
    assert load_res.status_code == 200

    # Request chart data
    chart_req = {
        "session_id": session_id,
        "chart_type": "line",
        "x_col": "MedInc",
        "y_col": "MedHouseVal",
        "aggregation": "mean",
        "bins": 10,
        "bin_numeric": True,
        "sort_by": "auto"
    }

    res = test_client.post("/api/datasets/chart-data", json=chart_req)
    assert res.status_code == 200
    json_data = res.json()

    assert json_data["chart_type"] == "line"
    assert len(json_data["data"]) == 10
    assert json_data["total_rows"] == 20640
    assert json_data["insights"]["correlation"] > 0.65
