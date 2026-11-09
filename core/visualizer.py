"""
Plotly Visualizer Module for OpenDataLens
Customized with UI/UX Pro Max Enterprise Data-Dense Dashboard Theme.
"""

from typing import List, Optional
import numpy as np
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px

from core.config import THEME_COLORS


def _apply_theme(fig: go.Figure, title: str = "", height: int = 400) -> go.Figure:
    """Apply consistent UI/UX Pro Max styling to Plotly figures."""
    fig.update_layout(
        title={
            "text": f"<b>{title}</b>" if title else "",
            "y": 0.95,
            "x": 0.02,
            "xanchor": "left",
            "yanchor": "top",
            "font": {"size": 16, "color": THEME_COLORS["text_primary"], "family": "Inter, Segoe UI, sans-serif"}
        },
        height=height,
        paper_bgcolor=THEME_COLORS["surface"],
        plot_bgcolor=THEME_COLORS["background"],
        margin=dict(l=40, r=40, t=60, b=40),
        font={"family": "Inter, Segoe UI, sans-serif", "color": THEME_COLORS["text_secondary"]},
        hoverlabel=dict(
            bgcolor=THEME_COLORS["primary_dark"],
            font_size=12,
            font_color="#FFFFFF",
            font_family="Inter, sans-serif"
        ),
        xaxis=dict(
            showgrid=True,
            gridcolor=THEME_COLORS["border"],
            linecolor=THEME_COLORS["border_subtle"],
            zeroline=False
        ),
        yaxis=dict(
            showgrid=True,
            gridcolor=THEME_COLORS["border"],
            linecolor=THEME_COLORS["border_subtle"],
            zeroline=False
        )
    )
    return fig


def plot_missing_values_bar(df: pd.DataFrame) -> go.Figure:
    """Bar chart showing missing value percentage per column."""
    missing = (df.isna().sum() / len(df)) * 100.0
    missing = missing.sort_values(ascending=False)
    
    # Filter to only columns with missing values if any, else show all
    has_missing = missing[missing > 0]
    display_series = has_missing if len(has_missing) > 0 else missing.head(10)

    colors = [THEME_COLORS["danger"] if p > 30 else THEME_COLORS["accent"] if p > 5 else THEME_COLORS["primary_light"] for p in display_series.values]

    fig = go.Figure(data=[
        go.Bar(
            x=display_series.index.tolist(),
            y=display_series.values.tolist(),
            marker_color=colors,
            text=[f"{v:.1f}%" for v in display_series.values],
            textposition="outside",
            hovertemplate="<b>%{x}</b><br>Missing: %{y:.2f}%<extra></extra>"
        )
    ])
    fig.update_layout(yaxis_range=[0, max(100, float(display_series.max() if len(display_series) > 0 else 10) * 1.2)])
    return _apply_theme(fig, title="Missing Value Ratio by Column (%)", height=380)


def plot_missing_matrix(df: pd.DataFrame, max_rows: int = 200) -> go.Figure:
    """Heatmap matrix of missing vs present values across sample rows."""
    sample = df.head(max_rows).isna().astype(int)
    
    fig = go.Figure(data=go.Heatmap(
        z=sample.values,
        x=sample.columns.tolist(),
        y=list(range(len(sample))),
        colorscale=[[0, THEME_COLORS["background"]], [1, THEME_COLORS["danger"]]],
        showscale=False,
        hovertemplate="Row: %{y}<br>Column: %{x}<br>Status: %{text}<extra></extra>",
        text=[["Missing" if v == 1 else "Present" for v in row] for row in sample.values]
    ))
    return _apply_theme(fig, title=f"Missingness Sparsity Matrix (First {len(sample)} Rows)", height=350)


def plot_correlation_heatmap(df: pd.DataFrame) -> go.Figure:
    """Correlation matrix heatmap for all numerical features."""
    num_df = df.select_dtypes(include=[np.number])
    if num_df.shape[1] < 2:
        fig = go.Figure()
        fig.add_annotation(text="Insufficient numerical columns for correlation matrix", showarrow=False)
        return _apply_theme(fig, title="Correlation Heatmap", height=350)

    corr = num_df.corr().round(2)
    fig = go.Figure(data=go.Heatmap(
        z=corr.values,
        x=corr.columns.tolist(),
        y=corr.index.tolist(),
        colorscale="Blues",
        zmin=-1,
        zmax=1,
        text=corr.values,
        texttemplate="%{text}",
        textfont={"size": 11},
        hovertemplate="<b>%{x}</b> vs <b>%{y}</b><br>Pearson r: %{z}<extra></extra>"
    ))
    return _apply_theme(fig, title="Feature Correlation Matrix (Pearson r)", height=450)


def plot_feature_distribution(df: pd.DataFrame, column: str) -> go.Figure:
    """Distribution histogram or category bar plot for a given feature."""
    series = df[column].dropna()
    if pd.api.types.is_numeric_dtype(series):
        fig = go.Figure()
        fig.add_trace(go.Histogram(
            x=series,
            marker_color=THEME_COLORS["primary_light"],
            opacity=0.85,
            autobinx=True,
            hovertemplate="Value range: %{x}<br>Count: %{y}<extra></extra>"
        ))
        return _apply_theme(fig, title=f"Numeric Distribution: {column}", height=380)
    else:
        top_cats = series.value_counts().head(15)
        fig = go.Figure(data=[
            go.Bar(
                x=top_cats.index.astype(str).tolist(),
                y=top_cats.values.tolist(),
                marker_color=THEME_COLORS["accent"],
                text=top_cats.values,
                textposition="outside",
                hovertemplate="Category: %{x}<br>Count: %{y}<extra></extra>"
            )
        ])
        return _apply_theme(fig, title=f"Category Frequencies: {column}", height=380)


def plot_confusion_matrix_heatmap(cm: np.ndarray, labels: List[str]) -> go.Figure:
    """Interactive confusion matrix heatmap for classification."""
    fig = go.Figure(data=go.Heatmap(
        z=cm,
        x=[f"Pred: {lbl}" for lbl in labels],
        y=[f"True: {lbl}" for lbl in labels],
        colorscale="Blues",
        text=cm,
        texttemplate="<b>%{text}</b>",
        textfont={"size": 14},
        hovertemplate="True: %{y}<br>Predicted: %{x}<br>Samples: %{z}<extra></extra>"
    ))
    fig.update_layout(yaxis_autorange="reversed")
    return _apply_theme(fig, title="Confusion Matrix", height=400)


def plot_regression_residuals(y_true: np.ndarray, y_pred: np.ndarray) -> go.Figure:
    """Dual-plot: Actual vs Predicted and Residuals Scatter Plot."""
    residuals = y_true - y_pred

    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=y_pred,
        y=residuals,
        mode="markers",
        marker=dict(color=THEME_COLORS["primary_light"], size=7, opacity=0.7),
        name="Residuals",
        hovertemplate="Predicted: %{x:.3f}<br>Residual: %{y:.3f}<extra></extra>"
    ))
    # Zero line
    fig.add_hline(y=0, line_dash="dash", line_color=THEME_COLORS["danger"], line_width=2)
    return _apply_theme(fig, title="Residual Plot (Predicted vs Residuals)", height=380)


def plot_model_comparison_bar(comparison_df: pd.DataFrame, metric_col: str) -> go.Figure:
    """Bar chart comparing all trained models on the selected primary metric."""
    if comparison_df.empty or metric_col not in comparison_df.columns:
        fig = go.Figure()
        return _apply_theme(fig, title="Model Comparison", height=380)

    sorted_df = comparison_df.sort_values(by=metric_col, ascending=False)
    # Highlight the best model with accent color
    best_idx = 0
    colors = [THEME_COLORS["accent"] if i == best_idx else THEME_COLORS["primary_light"] for i in range(len(sorted_df))]

    fig = go.Figure(data=[
        go.Bar(
            x=sorted_df["Model"].tolist(),
            y=sorted_df[metric_col].tolist(),
            marker_color=colors,
            text=[f"{v:.4f}" for v in sorted_df[metric_col]],
            textposition="outside",
            hovertemplate="Model: %{x}<br>" + metric_col + ": %{y:.4f}<extra></extra>"
        )
    ])
    return _apply_theme(fig, title=f"Model Comparison: {metric_col} (Best Highlighted)", height=400)
