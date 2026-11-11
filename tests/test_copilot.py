"""
Tests for Deterministic AI Copilot Engine.
"""

import pytest
from core.copilot import answer_with_heuristics


def test_copilot_dataset_overview():
    meta = {
        "name": "Iris Flower Dataset",
        "rows": 150,
        "cols": 5,
        "task": "classification",
        "suggested_target": "target",
        "description": "Botanical measurements of Iris flowers."
    }
    res = answer_with_heuristics("Explain my dataset", dataset_meta=meta)
    assert "Iris Flower Dataset" in res["answer"]
    assert "150 rows" in res["answer"]
    assert res["intent"] == "dataset_overview"


def test_copilot_missing_values():
    quality = {
        "missing_values": {
            "column_summary": {
                "age": {"missing_count": 20, "missing_pct": 10.0},
                "fare": {"missing_count": 0, "missing_pct": 0.0}
            }
        }
    }
    res = answer_with_heuristics("Which columns have missing values?", quality_analysis=quality)
    assert "age" in res["answer"]
    assert "fare" not in res["answer"]
    assert res["intent"] == "missing_values"


def test_copilot_best_model():
    ml_results = {
        "comparison_table": [
            {"Model": "Random Forest", "Accuracy": 0.96, "F1 Score (Macro)": 0.95, "CV Score (Mean ± Std)": "0.94 ± 0.02", "Training Time (s)": 0.12},
            {"Model": "Logistic Regression", "Accuracy": 0.92, "F1 Score (Macro)": 0.91, "CV Score (Mean ± Std)": "0.90 ± 0.03", "Training Time (s)": 0.03}
        ],
        "ml_meta": {"problem_type": "classification"}
    }
    res = answer_with_heuristics("Which is the best model?", ml_results=ml_results)
    assert "Random Forest" in res["answer"]
    assert "0.96" in res["answer"]
    assert res["intent"] == "model_performance"
