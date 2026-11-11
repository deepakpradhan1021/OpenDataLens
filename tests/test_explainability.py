"""
Tests for Explainable AI (Permutation Importance & Native Weights).
"""

import pytest
import numpy as np
import pandas as pd
from core.ml_studio import prepare_train_test_split, train_model_pipeline
from core.evaluator import compute_model_explainability, explain_single_prediction


@pytest.fixture
def sample_ml_data():
    np.random.seed(42)
    n = 150
    # X1 is strongly correlated with target, X2 is noise
    x1 = np.random.uniform(10, 50, n)
    x2 = np.random.normal(0, 1, n)
    target = (x1 > 30).astype(int)
    return pd.DataFrame({"x1": x1, "x2": x2, "target": target})


def test_permutation_importance(sample_ml_data):
    feature_cols = ["x1", "x2"]
    target_col = "target"
    X_train, X_test, y_train, y_test = prepare_train_test_split(
        sample_ml_data, feature_cols, target_col, test_size=0.3, problem_type="classification"
    )

    pipeline, _ = train_model_pipeline("random_forest", "classification", X_train, y_train)

    explain_res = compute_model_explainability(
        pipeline=pipeline,
        X_test=X_test,
        y_test=y_test,
        feature_names=feature_cols,
        problem_type="classification"
    )

    assert "permutation_importance" in explain_res
    assert len(explain_res["permutation_importance"]) == 2
    # x1 is the true driver, so it should rank first
    assert explain_res["top_drivers"][0] == "x1"
    assert explain_res["permutation_importance"][0]["feature"] == "x1"


def test_explain_single_prediction(sample_ml_data):
    feature_cols = ["x1", "x2"]
    target_col = "target"
    X_train, X_test, y_train, y_test = prepare_train_test_split(
        sample_ml_data, feature_cols, target_col, test_size=0.3, problem_type="classification"
    )

    pipeline, _ = train_model_pipeline("logistic_regression", "classification", X_train, y_train)

    sample_expl = explain_single_prediction(
        pipeline=pipeline,
        sample_row=X_test.iloc[0],
        feature_names=feature_cols,
        problem_type="classification"
    )

    assert "predicted_value" in sample_expl
    assert "feature_values" in sample_expl
    assert len(sample_expl["feature_values"]) == 2
