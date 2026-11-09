"""
Dataset Explorer Page for OpenDataLens
Allows searching Hugging Face Hub, loading via Dataset Viewer API,
uploading custom CSV files, and instant exploration of standard ML benchmarks.
"""

import streamlit as st
import pandas as pd
from core.dataset_loader import (
    load_curated_dataset,
    load_csv_dataset,
    search_hf_datasets,
    load_hf_dataset_via_api,
    get_sample_datasets_list
)
from core.quality_analyzer import analyze_data_quality
from ui.components import render_kpi_card, render_alert, render_empty_state, render_header_banner


def render_dataset_explorer():
    render_header_banner(
        title="Dataset Explorer",
        subtitle="Discover and ingest datasets from Hugging Face Hub, custom CSV uploads, or curated ML benchmarks."
    )

    tab_curated, tab_hf, tab_csv = st.tabs([
        "Curated Benchmarks (Instant)",
        "Hugging Face Hub Discovery",
        "Upload Custom CSV"
    ])

    # ---------------- TAB 1: CURATED BENCHMARKS ----------------
    with tab_curated:
        st.markdown("#### Select a Standard Benchmark Dataset")
        st.markdown("Pre-packaged, production-standard machine learning datasets ready for immediate quality profiling and modeling.")

        samples = get_sample_datasets_list()
        cols = st.columns(3)
        for i, s in enumerate(samples):
            col = cols[i % 3]
            with col:
                with st.container(border=True):
                    st.markdown(f"**{s['name']}**")
                    st.caption(f"Task: `{s['task'].upper()}` &bull; {s['rows']} rows &bull; {s['cols']} cols")
                    st.markdown(f"<p style='font-size: 0.85rem; color: #475569;'>{s['description']}</p>", unsafe_allow_html=True)
                    if st.button(f"Load {s['name']}", key=f"btn_curated_{s['id']}", use_container_width=True):
                        with st.spinner(f"Loading {s['name']}..."):
                            df, meta = load_curated_dataset(s["id"])
                            st.session_state["dataset"] = df
                            st.session_state["dataset_metadata"] = meta
                            st.session_state["quality_analysis"] = analyze_data_quality(df)
                            # Reset downstream models
                            st.session_state["trained_models"] = {}
                            st.session_state["model_evaluations"] = {}
                            st.session_state["comparison_df"] = None
                            st.success(f"Loaded '{s['name']}' ({df.shape[0]} rows, {df.shape[1]} columns) successfully!")
                            st.rerun()

    # ---------------- TAB 2: HUGGING FACE HUB ----------------
    with tab_hf:
        st.markdown("#### Search Hugging Face Hub")
        st.markdown("Discover public datasets across the Hugging Face ecosystem and stream records directly via the Dataset Viewer API.")

        col_search, col_btn = st.columns([4, 1])
        with col_search:
            hf_query = st.text_input(
                "Search datasets by keyword, domain, or task",
                value=st.session_state.get("hf_last_query", "tabular"),
                placeholder="e.g. tabular, financial, customer, iris, diabetes"
            )
        with col_btn:
            st.markdown("<div style='height: 28px;'></div>", unsafe_allow_html=True)
            search_btn = st.button("Search Hub", use_container_width=True, type="primary")

        if search_btn or "hf_search_results" not in st.session_state:
            with st.spinner("Querying Hugging Face Hub API..."):
                results = search_hf_datasets(query=hf_query, limit=9)
                st.session_state["hf_search_results"] = results
                st.session_state["hf_last_query"] = hf_query

        results = st.session_state.get("hf_search_results", [])
        if results:
            st.markdown(f"Found **{len(results)}** matching Hugging Face datasets:")
            hf_cols = st.columns(3)
            for idx, item in enumerate(results):
                hcol = hf_cols[idx % 3]
                with hcol:
                    with st.container(border=True):
                        st.markdown(f"**{item['name']}**")
                        st.caption(f"Author: `{item['author']}` &bull; Likes: {item['likes']} &bull; Downloads: {item['downloads']}")
                        desc = item.get("description", "")
                        short_desc = (desc[:100] + "...") if len(desc) > 100 else (desc or "No description.")
                        st.markdown(f"<p style='font-size: 0.82rem; color: #475569;'>{short_desc}</p>", unsafe_allow_html=True)
                        if st.button(f"Ingest via HF API", key=f"hf_load_{item['id']}_{idx}", use_container_width=True):
                            with st.spinner(f"Ingesting '{item['id']}' from Hugging Face Dataset Viewer..."):
                                try:
                                    df, meta = load_hf_dataset_via_api(item["id"])
                                    st.session_state["dataset"] = df
                                    st.session_state["dataset_metadata"] = meta
                                    st.session_state["quality_analysis"] = analyze_data_quality(df)
                                    st.session_state["trained_models"] = {}
                                    st.session_state["model_evaluations"] = {}
                                    st.session_state["comparison_df"] = None
                                    st.success(f"Successfully ingested '{item['id']}' ({len(df)} rows, {df.shape[1]} cols)!")
                                    st.rerun()
                                except Exception as exc:
                                    st.error(f"Failed to ingest from Hugging Face: {str(exc)}")
        else:
            st.info("No Hugging Face datasets found matching your search. Try a broader term like 'tabular' or 'classification'.")

    # ---------------- TAB 3: CSV UPLOAD ----------------
    with tab_csv:
        st.markdown("#### Upload Local Delimited Data")
        st.markdown("Automatic delimiter detection (comma, semicolon, tab, pipe) and character encoding inference.")

        uploaded_file = st.file_uploader(
            "Select CSV or text data file",
            type=["csv", "tsv", "txt"],
            help="Files are processed locally in-memory with strict data safety."
        )

        if uploaded_file is not None:
            col_u1, col_u2 = st.columns([3, 1])
            with col_u1:
                st.caption(f"Selected file: `{uploaded_file.name}` ({round(uploaded_file.size / 1024, 1)} KB)")
            with col_u2:
                load_btn = st.button("Parse & Ingest File", type="primary", use_container_width=True)

            if load_btn:
                with st.spinner("Analyzing and parsing uploaded data..."):
                    try:
                        df, meta = load_csv_dataset(uploaded_file, filename=uploaded_file.name)
                        st.session_state["dataset"] = df
                        st.session_state["dataset_metadata"] = meta
                        st.session_state["quality_analysis"] = analyze_data_quality(df)
                        st.session_state["trained_models"] = {}
                        st.session_state["model_evaluations"] = {}
                        st.session_state["comparison_df"] = None
                        st.success(f"Ingested '{uploaded_file.name}' successfully! ({df.shape[0]} rows, {df.shape[1]} columns)")
                        st.rerun()
                    except Exception as err:
                        st.error(f"Error parsing file: {str(err)}")

    # ---------------- ACTIVE DATASET PREVIEW ----------------
    st.markdown("---")
    st.markdown("### Active Dataset Overview")

    if "dataset" in st.session_state and st.session_state["dataset"] is not None:
        df = st.session_state["dataset"]
        meta = st.session_state.get("dataset_metadata", {})
        analysis = st.session_state.get("quality_analysis", {})
        overview = analysis.get("overview", {})

        kp1, kp2, kp3, kp4 = st.columns(4)
        with kp1:
            render_kpi_card("Total Rows", f"{df.shape[0]:,}", subtext="Samples collected")
        with kp2:
            render_kpi_card("Total Columns", f"{df.shape[1]:,}", subtext="Variables / features")
        with kp3:
            render_kpi_card("Completeness", f"{overview.get('completeness_score', 100)}%", subtext="Non-missing cells")
        with kp4:
            render_kpi_card("Memory Footprint", f"{overview.get('memory_mb', 0.1)} MB", subtext="In-memory usage")

        st.markdown(f"**Dataset Name:** `{meta.get('name', 'Active Dataset')}` &bull; **Origin:** `{meta.get('source', 'CSV').upper()}`")

        # Column schema table
        with st.expander("Column Specifications & Data Types", expanded=False):
            schema_data = []
            for col in df.columns:
                series = df[col]
                schema_data.append({
                    "Column Name": col,
                    "Inferred Dtype": str(series.dtype),
                    "Non-Null Count": f"{series.count():,} / {len(df):,}",
                    "Null Count": f"{series.isna().sum():,}",
                    "Unique Values": series.nunique(),
                    "Sample Value": str(series.dropna().iloc[0]) if series.count() > 0 else "None"
                })
            st.dataframe(pd.DataFrame(schema_data), use_container_width=True, hide_index=True)

        # Interactive Data Preview
        st.markdown("#### Sample Records Preview")
        preview_rows = st.slider("Number of preview rows", min_value=5, max_value=min(100, len(df)), value=10, step=5)
        st.dataframe(df.head(preview_rows), use_container_width=True)

    else:
        render_empty_state(
            title="No Active Dataset Ingested",
            description="Select one of the curated benchmarks above, search Hugging Face Hub, or upload a CSV file to begin analysis.",
            action_suggestion="Click 'Load Iris Flower Dataset' above to explore instantly."
        )
