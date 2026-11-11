"""
Tests for Quality Intelligence (Outliers, Target Leakage, High Cardinality).
"""

import pytest
import numpy as np
import pandas as pd
from core.quality_analyzer import analyze_data_quality, detect_outliers_iqr, detect_high_cardinality


def test_outlier_detection_iqr():
    np.random.seed(42)
    # Normal distribution with variance plus 3 extreme synthetic outliers
    base_data = list(np.random.normal(50, 5, 100))
    data = base_data + [1000.0, -500.0, 999.0]
    df = pd.DataFrame({"measure": data})
    outliers = detect_outliers_iqr(df, ["measure"])

    assert "measure" in outliers
    assert outliers["measure"]["outlier_count"] >= 3
    assert outliers["measure"]["outlier_pct"] > 0


def test_high_cardinality_detection():
    # 60 unique categorical values in 100 rows
    cats = [f"cat_{i}" for i in range(60)] + ["cat_0"] * 40
    df = pd.DataFrame({"category": cats})
    high_card = detect_high_cardinality(df, ["category"])

    assert "category" in high_card
    assert high_card["category"]["unique_count"] == 60


def test_target_leakage_detection():
    np.random.seed(42)
    n = 100
    x = np.random.normal(50, 10, n)
    # y is almost identical to x -> correlation ~ 1.0
    y = x + np.random.normal(0, 0.001, n)
    df = pd.DataFrame({"feature_x": x, "feature_y": y})

    analysis = analyze_data_quality(df)
    assert "high_correlation_pairs" in analysis
    leakage = [p for p in analysis["high_correlation_pairs"] if p.get("is_leakage_risk")]
    assert len(leakage) > 0
    assert abs(leakage[0]["correlation"]) >= 0.95
