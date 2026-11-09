"""
Tests for ML Studio Engine.
"""

import pytest
import pandas as pd
import numpy as np
from core.ml_studio import (
    detect_target_candidates,
    build_preprocessor,
    train_model_pipeline,
    prepare_train_test_split
)


@pytest.fixture
def classification_sample():
    np.random.seed(42)
    n = 120
    return pd.DataFrame({
        "age": np.random.randint(18, 70, size=n),
        "income": np.random.normal(50000, 15000, size=n),
        "department": np.random.choice(["Sales", "Engineering", "Marketing"], size=n),
        "target_class": np.random.choice([0, 1], size=n, p=[0.6, 0.4])
    })


@pytest.fixture
def regression_sample():
    np.random.seed(42)
    n = 120
    x1 = np.random.uniform(1, 10, size=n)
    x2 = np.random.uniform(10, 50, size=n)
    category = np.random.choice(["Tier1", "Tier2"], size=n)
    target = 2.5 * x1 + 0.5 * x2 + np.random.normal(0, 1, size=n)
    return pd.DataFrame({
        "x1": x1,
        "x2": x2,
        "category": category,
        "target_continuous": target
    })


def test_detect_target_candidates_classification(classification_sample):
    candidates = detect_target_candidates(classification_sample)
    assert "classification" in candidates
    assert "target_class" in candidates["classification"]


def test_detect_target_candidates_regression(regression_sample):
    candidates = detect_target_candidates(regression_sample)
    assert "regression" in candidates
    assert "target_continuous" in candidates["regression"]


def test_prepare_train_test_split(classification_sample):
    feature_cols = ["age", "income", "department"]
    target_col = "target_class"
    X_train, X_test, y_train, y_test = prepare_train_test_split(
        classification_sample,
        feature_cols=feature_cols,
        target_col=target_col,
        test_size=0.25,
        problem_type="classification"
    )
    assert len(X_train) == 90
    assert len(X_test) == 30
    assert len(y_train) == 90
    assert len(y_test) == 30
    assert list(X_train.columns) == feature_cols


def test_train_classification_pipeline(classification_sample):
    feature_cols = ["age", "income", "department"]
    target_col = "target_class"
    X_train, X_test, y_train, y_test = prepare_train_test_split(
        classification_sample, feature_cols, target_col, test_size=0.25, problem_type="classification"
    )

    trained_pipe, fit_time = train_model_pipeline(
        model_name="random_forest",
        problem_type="classification",
        X_train=X_train,
        y_train=y_train,
        scaler_type="standard"
    )

    assert trained_pipe is not None
    assert fit_time >= 0
    preds = trained_pipe.predict(X_test)
    assert len(preds) == len(y_test)
    assert set(preds).issubset({0, 1})


def test_train_regression_pipeline(regression_sample):
    feature_cols = ["x1", "x2", "category"]
    target_col = "target_continuous"
    X_train, X_test, y_train, y_test = prepare_train_test_split(
        regression_sample, feature_cols, target_col, test_size=0.2, problem_type="regression"
    )

    trained_pipe, fit_time = train_model_pipeline(
        model_name="ridge_regression",
        problem_type="regression",
        X_train=X_train,
        y_train=y_train,
        scaler_type="robust"
    )

    assert trained_pipe is not None
    preds = trained_pipe.predict(X_test)
    assert len(preds) == len(y_test)
    assert isinstance(preds[0], (float, np.floating))
