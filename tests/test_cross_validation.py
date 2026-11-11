"""
Tests for Leak-Free Cross-Validation.
"""

import pytest
import numpy as np
import pandas as pd
from core.ml_studio import run_kfold_cross_validation


def test_classification_stratified_cv():
    np.random.seed(42)
    n = 100
    df = pd.DataFrame({
        "feat1": np.random.normal(0, 1, n),
        "feat2": np.random.uniform(10, 20, n),
        "target": np.random.choice([0, 1], size=n, p=[0.7, 0.3])
    })

    cv_res = run_kfold_cross_validation(
        model_name="logistic_regression",
        problem_type="classification",
        X_train=df[["feat1", "feat2"]],
        y_train=df["target"],
        scaler_type="standard",
        cv_folds=5
    )

    assert "folds" in cv_res
    assert len(cv_res["folds"]) == 5
    assert "mean" in cv_res
    assert "std" in cv_res
    assert 0.0 <= cv_res["mean"] <= 1.0


def test_regression_kfold_cv():
    np.random.seed(42)
    n = 80
    df = pd.DataFrame({
        "x": np.random.uniform(1, 10, n),
        "y": np.random.uniform(1, 10, n)
    })
    df["target"] = 2.0 * df["x"] + 1.0

    cv_res = run_kfold_cross_validation(
        model_name="ridge_regression",
        problem_type="regression",
        X_train=df[["x", "y"]],
        y_train=df["target"],
        cv_folds=4
    )

    assert len(cv_res["folds"]) == 4
    assert cv_res["metric"] == "R² Score"
    assert cv_res["mean"] > 0.8  # Strong linear signal
