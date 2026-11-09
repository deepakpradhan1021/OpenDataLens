"""
Tests for Visualizer Module.
"""

import pytest
import pandas as pd
import numpy as np
import plotly.graph_objects as go
from core.visualizer import (
    plot_missing_values_bar,
    plot_missing_matrix,
    plot_correlation_heatmap,
    plot_feature_distribution,
    plot_confusion_matrix_heatmap,
    plot_regression_residuals,
    plot_model_comparison_bar
)


@pytest.fixture
def sample_viz_df():
    np.random.seed(42)
    return pd.DataFrame({
        "num1": np.random.randn(100),
        "num2": np.random.randn(100) * 2 + 5,
        "cat1": np.random.choice(["A", "B", "C"], size=100),
        "missing_col": [np.nan if i % 4 == 0 else i for i in range(100)]
    })


def test_plot_missing_values_bar(sample_viz_df):
    fig = plot_missing_values_bar(sample_viz_df)
    assert isinstance(fig, go.Figure)
    assert len(fig.data) > 0


def test_plot_missing_matrix(sample_viz_df):
    fig = plot_missing_matrix(sample_viz_df)
    assert isinstance(fig, go.Figure)


def test_plot_correlation_heatmap(sample_viz_df):
    fig = plot_correlation_heatmap(sample_viz_df)
    assert isinstance(fig, go.Figure)


def test_plot_feature_distribution_numeric(sample_viz_df):
    fig = plot_feature_distribution(sample_viz_df, "num1")
    assert isinstance(fig, go.Figure)


def test_plot_feature_distribution_categorical(sample_viz_df):
    fig = plot_feature_distribution(sample_viz_df, "cat1")
    assert isinstance(fig, go.Figure)


def test_plot_confusion_matrix_heatmap():
    cm = np.array([[50, 2], [5, 43]])
    labels = ["Class 0", "Class 1"]
    fig = plot_confusion_matrix_heatmap(cm, labels)
    assert isinstance(fig, go.Figure)


def test_plot_regression_residuals():
    y_true = np.array([10.0, 20.0, 30.0, 40.0])
    y_pred = np.array([10.5, 19.2, 31.0, 38.8])
    fig = plot_regression_residuals(y_true, y_pred)
    assert isinstance(fig, go.Figure)


def test_plot_model_comparison_bar():
    comp_df = pd.DataFrame({
        "Model": ["Logistic Regression", "Random Forest"],
        "Accuracy": [0.85, 0.92],
        "F1 Score": [0.84, 0.91]
    })
    fig = plot_model_comparison_bar(comp_df, metric_col="Accuracy")
    assert isinstance(fig, go.Figure)
