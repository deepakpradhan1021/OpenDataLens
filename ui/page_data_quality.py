"""
Data Quality Analysis Page for OpenDataLens
Profiles missingness, duplicates, distributions, correlations, and offers actionable diagnostics.
"""

import streamlit as st
import pandas as pd
from core.quality_analyzer import analyze_data_quality, generate_quality_recommendations
from core.visualizer import (
    plot_missing_values_bar,
    plot_missing_matrix,
    plot_correlation_heatmap,
    plot_feature_distribution
)
from ui.components import render_kpi_card, render_alert, render_empty_state, render_header_banner


def render_data_quality():
    render_header_banner(
        title="Data Quality & Integrity Profiler",
        subtitle="Automated audit of completeness, duplicates, distributions, and actionable preprocessing recommendations."
    )

    if "dataset" not in st.session_state or st.session_state["dataset"] is None:
        render_empty_state(
            title="No Active Dataset Available",
            description="Please load or upload a dataset first in the Dataset Explorer tab.",
            action_suggestion="Navigate to 'Dataset Explorer' to load a benchmark or file."
        )
        return

    df = st.session_state["dataset"]
    analysis = st.session_state.get("quality_analysis")
    if analysis is None:
        with st.spinner("Analyzing data quality metrics..."):
            analysis = analyze_data_quality(df)
            st.session_state["quality_analysis"] = analysis

    overview = analysis["overview"]
    missing = analysis["missing_values"]
    recommendations = generate_quality_recommendations(analysis)

    # ---------------- 1. HEALTH KPIS ----------------
    k1, k2, k3, k4 = st.columns(4)
    with k1:
        comp_score = overview["completeness_score"]
        render_kpi_card("Completeness Score", f"{comp_score}%", subtext=f"{overview['total_missing_cells']:,} missing cells")
    with k2:
        dup_count = overview["duplicate_rows"]
        render_kpi_card("Duplicate Rows", f"{dup_count:,}", subtext=f"{overview['duplicate_pct']}% of dataset")
    with k3:
        cols_missing_cnt = missing["columns_with_missing_count"]
        render_kpi_card("Affected Columns", f"{cols_missing_cnt} / {overview['total_cols']}", subtext="Columns with NaNs")
    with k4:
        render_kpi_card("Memory Footprint", f"{overview['memory_mb']} MB", subtext=f"{overview['total_cells']:,} total cells")

    # ---------------- 2. ACTIONABLE RECOMMENDATIONS ----------------
    st.markdown("### Actionable Quality Recommendations")
    if recommendations:
        for rec in recommendations:
            render_alert(
                title=rec["title"],
                description=rec["description"],
                action=rec.get("action"),
                alert_type=rec.get("type", "info")
            )
    else:
        render_alert(
            title="Clean Dataset Profile",
            description="No significant data quality defects or anomalies were identified.",
            alert_type="success"
        )

    # ---------------- 3. DETAILED QUALITY TABS ----------------
    tab_missing, tab_dist, tab_stats = st.tabs([
        "Missing Data Profiling",
        "Distributions & Correlations",
        "Statistical Summaries"
    ])

    with tab_missing:
        st.markdown("#### Missing Value Patterns")
        col_m1, col_m2 = st.columns([1, 1])
        with col_m1:
            st.plotly_chart(plot_missing_values_bar(df), use_container_width=True)
        with col_m2:
            st.plotly_chart(plot_missing_matrix(df, max_rows=150), use_container_width=True)

        with st.expander("Per-Column Missing Value Breakdown", expanded=False):
            m_summary_list = []
            for col_name, data in missing["column_summary"].items():
                m_summary_list.append({
                    "Column": col_name,
                    "Data Type": data["dtype"],
                    "Missing Count": data["missing_count"],
                    "Missing (%)": f"{data['missing_pct']}%",
                    "Valid Samples": data["present_count"]
                })
            st.dataframe(pd.DataFrame(m_summary_list), use_container_width=True, hide_index=True)

    with tab_dist:
        st.markdown("#### Feature Distribution & Multicollinearity")
        selected_col = st.selectbox(
            "Select feature to visualize distribution:",
            options=df.columns.tolist()
        )
        st.plotly_chart(plot_feature_distribution(df, selected_col), use_container_width=True)

        st.markdown("---")
        st.markdown("#### Numerical Correlation Heatmap")
        st.plotly_chart(plot_correlation_heatmap(df), use_container_width=True)

    with tab_stats:
        st.markdown("#### Numerical Feature Moments")
        num_stats = analysis["statistics"]["numeric_stats"]
        if num_stats:
            num_records = []
            for col, stats in num_stats.items():
                row_dict = {"Feature": col}
                row_dict.update(stats)
                num_records.append(row_dict)
            st.dataframe(pd.DataFrame(num_records), use_container_width=True, hide_index=True)
        else:
            st.info("No numerical features available for continuous statistics.")

        st.markdown("---")
        st.markdown("#### Categorical Cardinality & Mode Frequencies")
        cat_stats = analysis["statistics"]["categorical_stats"]
        if cat_stats:
            cat_records = []
            for col, stats in cat_stats.items():
                cat_records.append({
                    "Feature": col,
                    "Count": stats["count"],
                    "Unique Values": stats["unique"],
                    "Top Category (Mode)": stats["top"],
                    "Mode Frequency": stats["top_freq"],
                    "Mode Share": f"{stats['top_freq_pct']}%"
                })
            st.dataframe(pd.DataFrame(cat_records), use_container_width=True, hide_index=True)
        else:
            st.info("No categorical or discrete text features detected.")
