"""
Edge Case and Robustness Tests for OpenDataLens
Validates failure modes, corrupted data, boundary conditions, and unsupported types.
"""

import io
import pytest
import numpy as np
import pandas as pd
from core.dataset_loader import load_csv_dataset
from core.quality_analyzer import analyze_data_quality, detect_column_types
from core.ml_studio import (
    detect_target_candidates,
    prepare_train_test_split,
    build_preprocessor,
    train_model_pipeline
)
from core.evaluator import (
    evaluate_classification_model,
    evaluate_regression_model,
    build_comparison_table,
    get_best_model_summary
)


def test_corrupted_delimiter_csv():
    # Pipe delimited with spaces
    csv_raw = " col_a | col_b | col_c \n 1 | 2.0 | hello \n 3 | 4.0 | world \n"
    df, meta = load_csv_dataset(io.StringIO(csv_raw), filename="pipe.csv")
    assert df.shape == (2, 3)
    assert meta["delimiter"] == "|"
    assert "col_a" in df.columns


def test_csv_with_all_nans_in_one_column():
    csv_raw = "feature_a,all_nan,target\n1,NaN,0\n2,,1\n3,NaN,0\n4,,1\n5,NaN,0\n6,,1\n7,NaN,0\n8,,1\n9,NaN,0\n10,,1\n11,NaN,0\n12,,1\n"
    df, meta = load_csv_dataset(io.StringIO(csv_raw), filename="nans.csv")
    assert df["all_nan"].isna().all()
    
    types = detect_column_types(df)
    assert "all_nan" in types["constant"]


def test_single_class_target_failure():
    # Only 1 class present in target -> classification should fail with clear message
    df = pd.DataFrame({
        "feat1": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        "feat2": [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120],
        "bad_target": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    })
    
    # Stratified split or class validation should handle single-class targets
    candidates = detect_target_candidates(df)
    assert "bad_target" not in candidates["classification"]


def test_missing_feature_column_in_split():
    df = pd.DataFrame({"a": list(range(15)), "target": [0, 1] * 7 + [0]})
    with pytest.raises(ValueError, match="Feature columns missing"):
        prepare_train_test_split(df, feature_cols=["non_existent_col"], target_col="target")


def test_insufficient_samples_split():
    tiny_df = pd.DataFrame({"a": [1, 2], "target": [0, 1]})
    with pytest.raises(ValueError, match="Insufficient data rows"):
        prepare_train_test_split(tiny_df, feature_cols=["a"], target_col="target")


def test_zero_division_evaluator():
    # Predictions where a class is never predicted
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import StandardScaler
    from sklearn.linear_model import LogisticRegression

    X = pd.DataFrame({"f1": [1.0, 2.0, 3.0, 4.0, 5.0, 6.0]})
    y = pd.Series([0, 0, 0, 1, 1, 1])
    pipe = Pipeline([("scaler", StandardScaler()), ("clf", LogisticRegression())])
    pipe.fit(X, y)

    # Test evaluation with zero division
    res = evaluate_classification_model(pipe, X, y)
    assert res["metrics"]["precision_macro"] >= 0.0
    assert res["metrics"]["recall_macro"] >= 0.0


def test_empty_comparison_table():
    empty_comp = build_comparison_table({}, problem_type="classification")
    assert empty_comp.empty
    best_name, metric, score = get_best_model_summary(empty_comp, "classification")
    assert best_name == "None"
    assert score == 0.0
