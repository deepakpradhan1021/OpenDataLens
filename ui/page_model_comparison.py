"""
Model Comparison and Deep Evaluation Page for OpenDataLens
Interactive metric comparisons, champion model highlight, confusion matrix, and residual diagnostics.
"""

import streamlit as st
import pandas as pd
import numpy as np
import plotly.graph_objects as go

from core.evaluator import get_best_model_summary
from core.visualizer import (
    plot_model_comparison_bar,
    plot_confusion_matrix_heatmap,
    plot_regression_residuals
)
from ui.components import render_kpi_card, render_empty_state, render_header_banner
from core.config import THEME_COLORS


def render_model_comparison():
    render_header_banner(
        title="Model Comparison & Evaluation",
        subtitle="Side-by-side performance benchmarks, automated champion selection, and error diagnostics."
    )

    if (
        "model_evaluations" not in st.session_state or
        not st.session_state["model_evaluations"] or
        "comparison_df" not in st.session_state or
        st.session_state["comparison_df"] is None
    ):
        render_empty_state(
            title="No Trained Models Available",
            description="Train one or more baseline models in the ML Studio page to benchmark their performance.",
            action_suggestion="Navigate to 'ML Studio' to start model training."
        )
        return

    eval_dict = st.session_state["model_evaluations"]
    comp_df = st.session_state["comparison_df"]
    ml_meta = st.session_state.get("ml_meta", {})
    problem_type = ml_meta.get("problem_type", "classification")

    # Determine best model
    best_name, primary_metric, best_val = get_best_model_summary(comp_df, problem_type=problem_type)

    # ---------------- 1. CHAMPION HIGHLIGHT ----------------
    st.markdown(
        f"""
        <div class="odl-champion-card">
            <div style="font-size: 0.82rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: {THEME_COLORS['accent_hover']};">
                Top Performing Architecture
            </div>
            <div style="font-size: 1.8rem; font-weight: 800; color: #1E293B; margin: 4px 0;">
                {best_name}
            </div>
            <div style="font-size: 0.95rem; color: #475569;">
                Achieved highest <strong>{primary_metric}</strong> score of <span style="font-weight: 700; color: {THEME_COLORS['primary']};">{best_val:.4f}</span> on unseen test data.
            </div>
        </div>
        """,
        unsafe_allow_html=True
    )

    # ---------------- 2. COMPARISON SCOREBOARD ----------------
    st.markdown("### Performance Scoreboard")
    st.dataframe(
        comp_df.style.highlight_max(
            subset=[c for c in comp_df.columns if c not in ["Model", "Training Time (s)", "RMSE", "MAE", "MSE"]],
            color="#FEF3C7"
        ),
        use_container_width=True,
        hide_index=True
    )

    # ---------------- 3. COMPARISON CHART ----------------
    st.markdown("---")
    st.markdown("### Multi-Model Metric Visualizer")

    metric_cols = [c for c in comp_df.columns if c not in ["Model", "Training Time (s)"]]
    selected_chart_metric = st.selectbox("Compare models across metric:", options=metric_cols, index=0)
    st.plotly_chart(
        plot_model_comparison_bar(comp_df, selected_chart_metric),
        use_container_width=True
    )

    # ---------------- 4. DEEP MODEL DIAGNOSTICS ----------------
    st.markdown("---")
    st.markdown("### Deep Architectural Inspection")

    model_names = [ev["model_name"] for ev in eval_dict.values()]
    inspected_model_name = st.selectbox("Select model to inspect in detail:", options=model_names, index=0)

    # Find the corresponding eval entry
    inspected_eval = next((ev for ev in eval_dict.values() if ev["model_name"] == inspected_model_name), None)

    if inspected_eval:
        col_d1, col_d2 = st.columns([1, 1])

        if problem_type == "classification":
            with col_d1:
                st.markdown("#### Confusion Matrix")
                cm = np.array(inspected_eval["confusion_matrix"])
                labels = inspected_eval.get("class_labels", [])
                st.plotly_chart(plot_confusion_matrix_heatmap(cm, labels), use_container_width=True)

            with col_d2:
                st.markdown("#### Detailed Classification Report")
                rep = inspected_eval.get("classification_report", {})
                rep_records = []
                for class_key, metrics in rep.items():
                    if isinstance(metrics, dict):
                        rep_records.append({
                            "Class": class_key,
                            "Precision": round(metrics.get("precision", 0.0), 4),
                            "Recall": round(metrics.get("recall", 0.0), 4),
                            "F1-Score": round(metrics.get("f1-score", 0.0), 4),
                            "Support": int(metrics.get("support", 0))
                        })
                st.dataframe(pd.DataFrame(rep_records), use_container_width=True, hide_index=True)

        else:
            y_true = np.array(inspected_eval.get("ground_truth", []))
            y_pred = np.array(inspected_eval.get("predictions", []))

            with col_d1:
                st.markdown("#### Residual Diagnostics (y_true - y_pred)")
                st.plotly_chart(plot_regression_residuals(y_true, y_pred), use_container_width=True)

            with col_d2:
                st.markdown("#### Actual vs. Predicted Parity Plot")
                fig_parity = go.Figure()
                fig_parity.add_trace(go.Scatter(
                    x=y_true,
                    y=y_pred,
                    mode="markers",
                    marker=dict(color=THEME_COLORS["primary_light"], size=6, opacity=0.75),
                    name="Predictions",
                    hovertemplate="Actual: %{x:.3f}<br>Predicted: %{y:.3f}<extra></extra>"
                ))
                min_val = min(y_true.min(), y_pred.min())
                max_val = max(y_true.max(), y_pred.max())
                fig_parity.add_trace(go.Scatter(
                    x=[min_val, max_val],
                    y=[min_val, max_val],
                    mode="lines",
                    line=dict(color=THEME_COLORS["accent"], dash="dash"),
                    name="Ideal (y = x)"
                ))
                fig_parity.update_layout(
                    title="Actual vs Predicted Values",
                    paper_bgcolor=THEME_COLORS["surface"],
                    plot_bgcolor=THEME_COLORS["background"],
                    height=380,
                    margin=dict(l=40, r=40, t=60, b=40)
                )
                st.plotly_chart(fig_parity, use_container_width=True)
