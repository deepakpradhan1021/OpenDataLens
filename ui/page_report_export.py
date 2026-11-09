"""
Evaluation Reports and Artifact Export Page for OpenDataLens
Enables downloading HTML/JSON/Markdown evaluation reports, serialized Joblib pipelines,
and processed dataset snapshots.
"""

import streamlit as st
import pandas as pd
from core.report_generator import (
    generate_html_report,
    generate_json_report,
    generate_markdown_report,
    export_model_pipeline_bytes
)
from core.evaluator import get_best_model_summary
from ui.components import render_kpi_card, render_empty_state, render_header_banner
from core.config import THEME_COLORS


def render_report_export():
    render_header_banner(
        title="Evaluation Reports & Model Export",
        subtitle="Generate executive reports and package serialized Scikit-learn pipelines for production deployment."
    )

    if (
        "model_evaluations" not in st.session_state or
        not st.session_state["model_evaluations"] or
        "comparison_df" not in st.session_state or
        st.session_state["comparison_df"] is None
    ):
        render_empty_state(
            title="No Evaluation Telemetry Available",
            description="Train and evaluate baseline models first in the ML Studio to generate exportable reports.",
            action_suggestion="Navigate to 'ML Studio' to train your models."
        )
        return

    dataset_meta = st.session_state.get("dataset_metadata", {})
    quality_summary = st.session_state.get("quality_analysis", {})
    eval_dict = st.session_state["model_evaluations"]
    comp_df = st.session_state["comparison_df"]
    trained_models = st.session_state.get("trained_models", {})
    ml_meta = st.session_state.get("ml_meta", {})
    problem_type = ml_meta.get("problem_type", "classification")

    best_name, primary_metric, best_val = get_best_model_summary(comp_df, problem_type=problem_type)
    best_info = {
        "name": best_name,
        "metric": primary_metric,
        "score": best_val
    }

    # Generate report strings
    html_report = generate_html_report(dataset_meta, quality_summary, eval_dict, best_info, problem_type)
    json_report = generate_json_report(dataset_meta, quality_summary, eval_dict, best_info, problem_type)
    md_report = generate_markdown_report(dataset_meta, quality_summary, eval_dict, best_info, problem_type)

    st.markdown("### 1. Download Evaluation Reports")
    st.markdown("Download comprehensive reports formatted for stakeholders, engineering reviews, or CI telemetry.")

    col_r1, col_r2, col_r3 = st.columns(3)
    with col_r1:
        st.download_button(
            label="Download HTML Report",
            data=html_report,
            file_name=f"OpenDataLens_Report_{dataset_meta.get('id', 'dataset')}.html",
            mime="text/html",
            use_container_width=True
        )
        st.caption("Self-contained styled HTML file for browser presentation.")

    with col_r2:
        st.download_button(
            label="Download JSON Report",
            data=json_report,
            file_name=f"OpenDataLens_Report_{dataset_meta.get('id', 'dataset')}.json",
            mime="application/json",
            use_container_width=True
        )
        st.caption("Structured JSON telemetry payload with full metrics.")

    with col_r3:
        st.download_button(
            label="Download Markdown Report",
            data=md_report,
            file_name=f"OpenDataLens_Report_{dataset_meta.get('id', 'dataset')}.md",
            mime="text/markdown",
            use_container_width=True
        )
        st.caption("Clean GitHub Flavored Markdown for documentation.")

    st.markdown("---")
    st.markdown("### 2. Export Serialized Scikit-learn Pipeline (.joblib)")
    st.markdown("Download an inference-ready pipeline containing the fitted preprocessor (imputation + scaling + encoding) coupled with the trained estimator.")

    model_options = list(trained_models.keys())
    # Pre-select champion model if found
    champion_key = next((k for k, ev in eval_dict.items() if ev.get("model_name") == best_name), model_options[0])

    col_m1, col_m2 = st.columns([2, 1])
    with col_m1:
        chosen_export_key = st.selectbox(
            "Select Pipeline Architecture to Export:",
            options=model_options,
            index=model_options.index(champion_key) if champion_key in model_options else 0,
            format_func=lambda k: f"{eval_dict.get(k, {}).get('model_name', k)} {' (Champion)' if k == champion_key else ''}"
        )
    with col_m2:
        st.markdown("<div style='height: 28px;'></div>", unsafe_allow_html=True)
        chosen_pipeline = trained_models[chosen_export_key]
        export_meta = {
            "model_name": eval_dict.get(chosen_export_key, {}).get("model_name", chosen_export_key),
            "problem_type": problem_type,
            "target": ml_meta.get("target_col"),
            "features": ml_meta.get("feature_cols"),
            "scaler": ml_meta.get("scaler"),
            "metrics": eval_dict.get(chosen_export_key, {}).get("metrics")
        }
        joblib_bytes = export_model_pipeline_bytes(chosen_pipeline, export_meta)

        st.download_button(
            label="Download .joblib Model",
            data=joblib_bytes,
            file_name=f"opendatalens_{chosen_export_key}_{dataset_meta.get('id', 'model')}.joblib",
            mime="application/octet-stream",
            type="primary",
            use_container_width=True
        )

    st.markdown("---")
    st.markdown("### 3. Export Processed Dataset")
    if "dataset" in st.session_state and st.session_state["dataset"] is not None:
        csv_bytes = st.session_state["dataset"].to_csv(index=False).encode("utf-8")
        st.download_button(
            label="Download Dataset as CSV",
            data=csv_bytes,
            file_name=f"opendatalens_dataset_{dataset_meta.get('id', 'export')}.csv",
            mime="text/csv"
        )

    st.markdown("---")
    st.markdown("### Live Report Preview")
    with st.expander("Expand HTML Report Preview", expanded=True):
        st.components.v1.html(html_report, height=600, scrolling=True)
