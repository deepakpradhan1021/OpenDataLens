"""
Tests for Data Quality Analyzer.
"""

import pytest
import pandas as pd
import numpy as np
from core.quality_analyzer import (
    analyze_data_quality,
    generate_quality_recommendations,
    detect_column_types
)


@pytest.fixture
def sample_quality_df():
    # DataFrame with missing values, duplicates, constant columns, high cardinality
    data = {
        "id": [1, 2, 3, 4, 5, 5],
        "constant_col": [10, 10, 10, 10, 10, 10],
        "num_with_missing": [1.0, np.nan, 3.0, 4.0, 5.0, 5.0],
        "heavy_missing": [np.nan, np.nan, np.nan, 100.0, np.nan, np.nan],
        "category_col": ["cat", "dog", "cat", "dog", "bird", "bird"],
        "target": [0, 1, 0, 1, 0, 0]
    }
    return pd.DataFrame(data)


def test_detect_column_types(sample_quality_df):
    types_info = detect_column_types(sample_quality_df)
    assert "constant_col" in types_info["constant"]
    assert "num_with_missing" in types_info["numeric"]
    assert "category_col" in types_info["categorical"]


def test_analyze_data_quality_metrics(sample_quality_df):
    results = analyze_data_quality(sample_quality_df)
    
    # Overview checks
    assert results["overview"]["total_rows"] == 6
    assert results["overview"]["total_cols"] == 6
    assert results["overview"]["duplicate_rows"] == 1
    assert results["overview"]["completeness_score"] < 100.0

    # Missing values check
    missing = results["missing_values"]
    assert missing["column_summary"]["heavy_missing"]["missing_count"] == 5
    assert missing["total_missing_cells"] == 6

    # Statistics check
    assert "numeric_stats" in results["statistics"]
    assert "categorical_stats" in results["statistics"]
    assert "num_with_missing" in results["statistics"]["numeric_stats"]


def test_generate_quality_recommendations(sample_quality_df):
    results = analyze_data_quality(sample_quality_df)
    recommendations = generate_quality_recommendations(results)
    
    assert isinstance(recommendations, list)
    assert len(recommendations) > 0
    
    rec_titles = [r["title"] for r in recommendations]
    assert any("Duplicate Records" in title for title in rec_titles)
    assert any("High Missing" in title or "Missing Values" in title for title in rec_titles)
    assert any("Constant" in title or "Zero-Variance" in title for title in rec_titles)


def test_empty_dataframe_quality():
    empty_df = pd.DataFrame()
    with pytest.raises(ValueError, match="empty"):
        analyze_data_quality(empty_df)
