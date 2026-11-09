"""
Tests for Model Evaluator and Comparison Module.
"""

import pytest
import numpy as np
import pandas as pd
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression, Ridge

from core.evaluator import (
    evaluate_classification_model,
    evaluate_regression_model,
    build_comparison_table,
    get_best_model_summary
)


@pytest.fixture
def dummy_classification_data():
    X = pd.DataFrame({"feat1": [1.0, 2.0, 3.0, 4.0, 5.0, 6.0]})
    y = pd.Series([0, 0, 0, 1, 1, 1])
    pipe = Pipeline([("scaler", StandardScaler()), ("clf", LogisticRegression())])
    pipe.fit(X, y)
    return pipe, X, y


@pytest.fixture
def dummy_regression_data():
    X = pd.DataFrame({"feat1": [1.0, 2.0, 3.0, 4.0, 5.0, 6.0]})
    y = pd.Series([2.1, 4.0, 5.9, 8.1, 10.2, 11.9])
    pipe = Pipeline([("scaler", StandardScaler()), ("reg", Ridge())])
    pipe.fit(X, y)
    return pipe, X, y


def test_evaluate_classification_model(dummy_classification_data):
    pipe, X, y = dummy_classification_data
    results = evaluate_classification_model(pipe, X, y, model_display_name="Test Logistic Regression")
    
    assert "metrics" in results
    metrics = results["metrics"]
    assert "accuracy" in metrics
    assert "f1_macro" in metrics
    assert "precision_macro" in metrics
    assert "recall_macro" in metrics
    assert 0.0 <= metrics["accuracy"] <= 1.0
    assert "confusion_matrix" in results
    assert isinstance(results["confusion_matrix"], list)


def test_evaluate_regression_model(dummy_regression_data):
    pipe, X, y = dummy_regression_data
    results = evaluate_regression_model(pipe, X, y, model_display_name="Test Ridge")
    
    assert "metrics" in results
    metrics = results["metrics"]
    assert "r2" in metrics
    assert "mae" in metrics
    assert "rmse" in metrics
    assert "mse" in metrics
    assert metrics["r2"] > 0.8
    assert metrics["mae"] >= 0.0


def test_build_comparison_table():
    eval_dict = {
        "m1": {
            "model_name": "Model 1",
            "fit_time": 0.05,
            "metrics": {"accuracy": 0.85, "f1_macro": 0.84, "precision_macro": 0.86, "recall_macro": 0.83}
        },
        "m2": {
            "model_name": "Model 2",
            "fit_time": 0.12,
            "metrics": {"accuracy": 0.92, "f1_macro": 0.91, "precision_macro": 0.93, "recall_macro": 0.90}
        }
    }
    comp_df = build_comparison_table(eval_dict, problem_type="classification")
    assert isinstance(comp_df, pd.DataFrame)
    assert len(comp_df) == 2
    assert "Accuracy" in comp_df.columns
    assert "F1 Score (Macro)" in comp_df.columns


def test_get_best_model_summary():
    comp_df = pd.DataFrame({
        "Model": ["Logistic Regression", "Random Forest"],
        "Accuracy": [0.85, 0.92],
        "F1 Score": [0.84, 0.91],
        "Training Time (s)": [0.02, 0.15]
    })
    best_name, primary_metric, best_val = get_best_model_summary(comp_df, problem_type="classification")
    assert best_name == "Random Forest"
    assert best_val == 0.92 or best_val == 0.91
