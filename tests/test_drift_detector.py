"""
Tests for Data Drift Detection Engine.
"""

import pytest
import numpy as np
import pandas as pd
from core.drift_detector import (
    calculate_psi,
    calculate_ks_test,
    calculate_categorical_drift,
    detect_dataset_drift
)


def test_calculate_psi_stable():
    np.random.seed(42)
    s1 = pd.Series(np.random.normal(50, 10, 500))
    s2 = pd.Series(np.random.normal(50, 10, 500))
    psi = calculate_psi(s1, s2)
    assert psi < 0.10  # Identical distributions should be stable


def test_calculate_psi_drifted():
    np.random.seed(42)
    s1 = pd.Series(np.random.normal(20, 5, 500))
    s2 = pd.Series(np.random.normal(80, 5, 500))
    psi = calculate_psi(s1, s2)
    assert psi >= 0.25  # Substantial shift should exceed warning threshold


def test_calculate_ks_test():
    np.random.seed(42)
    s1 = pd.Series(np.random.normal(0, 1, 300))
    s2 = pd.Series(np.random.normal(5, 1, 300))
    ks = calculate_ks_test(s1, s2)
    assert ks["statistic"] > 0.5
    assert ks["p_value"] < 0.01


def test_categorical_drift():
    s1 = pd.Series(["A"] * 80 + ["B"] * 20)
    s2 = pd.Series(["A"] * 20 + ["B"] * 80)
    res = calculate_categorical_drift(s1, s2)
    assert res["tvd"] > 0.4
    assert res["psi"] > 0.1


def test_detect_dataset_drift_end_to_end():
    np.random.seed(42)
    n = 200
    ref_df = pd.DataFrame({
        "age": np.random.normal(30, 5, n),
        "income": np.random.normal(60000, 10000, n),
        "tier": np.random.choice(["Bronze", "Silver"], size=n)
    })
    target_df = pd.DataFrame({
        "age": np.random.normal(55, 5, n),  # drifted
        "income": np.random.normal(60000, 10000, n),  # stable
        "tier": np.random.choice(["Bronze", "Silver"], size=n)
    })

    drift_report = detect_dataset_drift(ref_df, target_df)
    assert "overall_status" in drift_report
    assert "features" in drift_report
    assert len(drift_report["features"]) == 3

    # Age should be identified as drifted
    age_metric = next(f for f in drift_report["features"] if f["feature"] == "age")
    assert age_metric["status"] in ["drifted", "warning"]
    assert age_metric["psi"] > 0.1


def test_insufficient_sample_size_drift():
    # Less than 10 rows must return 'insufficient_data' rather than false 'stable'
    ref_df = pd.DataFrame({"feat": [1, 2, 3, 4, 5]})
    target_df = pd.DataFrame({"feat": [1, 2, 3, 4, 5]})
    report = detect_dataset_drift(ref_df, target_df)
    assert report["overall_status"] == "insufficient_data"
    assert report["badge_label"] == "Insufficient Data"


def test_schema_type_mismatch_drift():
    ref_df = pd.DataFrame({"feat": [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0, 11.0, 12.0]})
    target_df = pd.DataFrame({"feat": ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"]})
    report = detect_dataset_drift(ref_df, target_df)
    assert report["overall_status"] == "significant_drift"
    assert len(report["schema_changes"]["type_mismatches"]) == 1
    mismatch = report["schema_changes"]["type_mismatches"][0]
    assert mismatch["column"] == "feat"
    assert mismatch["reference_type"] == "numeric"
    assert mismatch["target_type"] == "categorical"
