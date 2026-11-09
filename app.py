"""
OpenDataLens — AI-Powered Dataset Explorer & Model Evaluation Platform
Main Streamlit Application Controller
"""

import streamlit as st

# Set page config MUST be the first Streamlit command
st.set_page_config(
    page_title="OpenDataLens — AI-Powered Dataset Explorer & ML Platform",
    page_icon="🔍",
    layout="wide",
    initial_sidebar_state="expanded"
)

from ui.styles import get_custom_css
from ui.page_dataset_explorer import render_dataset_explorer
from ui.page_data_quality import render_data_quality
from ui.page_ml_studio import render_ml_studio
from ui.page_model_comparison import render_model_comparison
from ui.page_report_export import render_report_export
from core.config import APP_NAME, APP_TAGLINE, APP_VERSION, THEME_COLORS

# Inject Design System CSS
st.markdown(get_custom_css(), unsafe_allow_html=True)


def init_session_state():
    """Initialize default session state keys."""
    if "dataset" not in st.session_state:
        st.session_state["dataset"] = None
    if "dataset_metadata" not in st.session_state:
        st.session_state["dataset_metadata"] = None
    if "quality_analysis" not in st.session_state:
        st.session_state["quality_analysis"] = None
    if "trained_models" not in st.session_state:
        st.session_state["trained_models"] = {}
    if "model_evaluations" not in st.session_state:
        st.session_state["model_evaluations"] = {}
    if "comparison_df" not in st.session_state:
        st.session_state["comparison_df"] = None
    if "ml_meta" not in st.session_state:
        st.session_state["ml_meta"] = {}


def main():
    init_session_state()

    # ---------------- SIDEBAR NAVIGATION ----------------
    with st.sidebar:
        st.markdown(
            f"""
            <div style="padding: 12px 0 16px 0; border-bottom: 1px solid {THEME_COLORS['border']}; margin-bottom: 16px;">
                <div style="font-size: 1.35rem; font-weight: 800; color: {THEME_COLORS['primary']}; letter-spacing: -0.02em;">
                    {APP_NAME}
                </div>
                <div style="font-size: 0.8rem; color: {THEME_COLORS['text_secondary']}; margin-top: 2px;">
                    {APP_TAGLINE}
                </div>
            </div>
            """,
            unsafe_allow_html=True
        )

        page_selection = st.radio(
            "Platform Navigation",
            options=[
                "Dataset Explorer",
                "Data Quality Analysis",
                "ML Studio",
                "Model Comparison",
                "Reports & Export"
            ],
            index=0
        )

        st.markdown("---")

        # Active Dataset Status Widget
        st.markdown("##### Active Workspace Context")
        if st.session_state["dataset"] is not None:
            meta = st.session_state.get("dataset_metadata", {})
            df = st.session_state["dataset"]
            st.markdown(
                f"""
                <div style="background-color: #F8FAFC; border: 1px solid {THEME_COLORS['border']}; border-radius: 8px; padding: 12px; font-size: 0.85rem;">
                    <div><strong>Dataset:</strong> {meta.get('name', 'Active Dataset')}</div>
                    <div><strong>Dimensions:</strong> {df.shape[0]:,} rows &bull; {df.shape[1]} cols</div>
                    <div><strong>Source:</strong> <span class="odl-badge odl-badge-primary">{meta.get('source', 'CSV').upper()}</span></div>
                </div>
                """,
                unsafe_allow_html=True
            )
        else:
            st.caption("No dataset loaded yet. Go to 'Dataset Explorer' to load a benchmark or CSV.")

        # Quick Reset Action
        if st.session_state["dataset"] is not None:
            if st.button("Reset Session State", use_container_width=True):
                st.session_state["dataset"] = None
                st.session_state["dataset_metadata"] = None
                st.session_state["quality_analysis"] = None
                st.session_state["trained_models"] = {}
                st.session_state["model_evaluations"] = {}
                st.session_state["comparison_df"] = None
                st.session_state["ml_meta"] = {}
                st.rerun()

        st.markdown("---")
        st.markdown(
            f"""
            <div style="font-size: 0.72rem; color: {THEME_COLORS['text_muted']}; text-align: center;">
                {APP_NAME} v{APP_VERSION} &bull; Enterprise Portfolio Build<br>
                Python &bull; Streamlit &bull; Scikit-learn &bull; Hugging Face
            </div>
            """,
            unsafe_allow_html=True
        )

    # ---------------- PAGE ROUTING ----------------
    if page_selection == "Dataset Explorer":
        render_dataset_explorer()
    elif page_selection == "Data Quality Analysis":
        render_data_quality()
    elif page_selection == "ML Studio":
        render_ml_studio()
    elif page_selection == "Model Comparison":
        render_model_comparison()
    elif page_selection == "Reports & Export":
        render_report_export()


if __name__ == "__main__":
    main()
