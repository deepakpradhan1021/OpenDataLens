"""
Reusable UI Components for OpenDataLens
Compliant with UI/UX Pro Max guidelines (no raw emojis as icons, clean typography, responsive layout).
"""

import streamlit as st
from typing import Optional, List
from core.config import THEME_COLORS


def render_kpi_card(
    label: str,
    value: str,
    subtext: str = "",
    delta: Optional[str] = None
) -> None:
    """Render an enterprise KPI card with label, prominent metric, and optional subtext."""
    delta_html = f"<span style='color: {THEME_COLORS['success']}; font-weight: 600; margin-left: 6px;'>{delta}</span>" if delta else ""
    st.markdown(
        f"""
        <div class="odl-kpi-card">
            <div class="odl-kpi-label">{label}</div>
            <div class="odl-kpi-value">{value}{delta_html}</div>
            {f'<div class="odl-kpi-subtext">{subtext}</div>' if subtext else ''}
        </div>
        """,
        unsafe_allow_html=True
    )


def render_alert(
    title: str,
    description: str,
    action: Optional[str] = None,
    alert_type: str = "info"
) -> None:
    """
    Render a styled feedback alert banner (types: warning, danger, info, success).
    """
    action_html = f"<div style='margin-top: 6px; font-weight: 500;'><strong>Suggested Action:</strong> {action}</div>" if action else ""
    st.markdown(
        f"""
        <div class="odl-alert odl-alert-{alert_type}">
            <div class="odl-alert-title">{title}</div>
            <div>{description}</div>
            {action_html}
        </div>
        """,
        unsafe_allow_html=True
    )


def render_empty_state(
    title: str,
    description: str,
    action_suggestion: str = ""
) -> None:
    """Render a clean placeholder container when no dataset or model is active."""
    st.markdown(
        f"""
        <div class="odl-empty-state">
            <div class="odl-empty-title">{title}</div>
            <div class="odl-empty-desc">{description}</div>
            {f'<div class="odl-badge odl-badge-primary">{action_suggestion}</div>' if action_suggestion else ''}
        </div>
        """,
        unsafe_allow_html=True
    )


def render_header_banner(
    title: str,
    subtitle: str
) -> None:
    """Render a branded top hero banner."""
    st.markdown(
        f"""
        <div class="odl-header-banner">
            <h1>{title}</h1>
            <p>{subtitle}</p>
        </div>
        """,
        unsafe_allow_html=True
    )


def render_badge(
    text: str,
    badge_type: str = "primary"
) -> str:
    """Return inline HTML badge."""
    return f'<span class="odl-badge odl-badge-{badge_type}">{text}</span>'
