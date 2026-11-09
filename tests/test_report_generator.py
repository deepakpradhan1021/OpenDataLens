"""
Tests for Report Generator and Model Export Module.
"""

import io
import json
import pytest
import joblib
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression

from core.report_generator import (
    generate_html_report,
    generate_json_report,
    generate_markdown_report,
    export_model_pipeline_bytes
)


@pytest.fixture
def sample_report_payload():
    dataset_meta = {
        "id": "iris",
        "name": "Iris Flower Dataset",
        "rows": 150,
        "cols": 5,
        "source": "curated",
        "target": "target"
    }
    quality_summary = {
        "overview": {
            "total_rows": 150,
            "total_cols": 5,
            "completeness_score": 100.0,
            "duplicate_rows": 1,
            "duplicate_pct": 0.67
        },
        "missing_values": {"total_missing_cells": 0, "columns_with_missing": []}
    }
    model_evaluations = {
        "rf": {
            "model_name": "Random Forest Classifier",
            "fit_time": 0.08,
            "metrics": {"accuracy": 0.9667, "f1_macro": 0.9665, "precision_macro": 0.9697, "recall_macro": 0.9667}
        },
        "lr": {
            "model_name": "Logistic Regression",
            "fit_time": 0.02,
            "metrics": {"accuracy": 0.9333, "f1_macro": 0.9326, "precision_macro": 0.9388, "recall_macro": 0.9333}
        }
    }
    best_model_info = {
        "name": "Random Forest Classifier",
        "metric": "F1 Score (Macro)",
        "score": 0.9665
    }
    return dataset_meta, quality_summary, model_evaluations, best_model_info, "classification"


def test_generate_html_report(sample_report_payload):
    meta, quality, evals, best, prob_type = sample_report_payload
    html = generate_html_report(meta, quality, evals, best, prob_type)
    assert isinstance(html, str)
    assert "<!DOCTYPE html>" in html
    assert "OpenDataLens" in html
    assert "Iris Flower Dataset" in html
    assert "Random Forest Classifier" in html
    assert "96.65%" in html or "0.9665" in html


def test_generate_json_report(sample_report_payload):
    meta, quality, evals, best, prob_type = sample_report_payload
    json_str = generate_json_report(meta, quality, evals, best, prob_type)
    data = json.loads(json_str)
    assert data["platform"] == "OpenDataLens"
    assert data["dataset"]["id"] == "iris"
    assert data["best_model"]["name"] == "Random Forest Classifier"


def test_generate_markdown_report(sample_report_payload):
    meta, quality, evals, best, prob_type = sample_report_payload
    md = generate_markdown_report(meta, quality, evals, best, prob_type)
    assert "# OpenDataLens Evaluation Report" in md
    assert "Random Forest Classifier" in md


def test_export_model_pipeline_bytes():
    pipe = Pipeline([("scaler", StandardScaler()), ("clf", LogisticRegression())])
    meta = {"model_name": "Logistic Regression", "target": "y", "features": ["x1", "x2"]}
    bytes_data = export_model_pipeline_bytes(pipe, meta)
    assert isinstance(bytes_data, bytes)
    assert len(bytes_data) > 0

    # Test loading back with joblib
    buffer = io.BytesIO(bytes_data)
    loaded_dict = joblib.load(buffer)
    assert "pipeline" in loaded_dict
    assert loaded_dict["metadata"]["model_name"] == "Logistic Regression"
