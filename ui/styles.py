"""
UI/UX Pro Max CSS Design System for OpenDataLens
Enterprise Data-Dense Dashboard Theme with custom cards, badges, and layout aesthetics.
"""

from core.config import THEME_COLORS


def get_custom_css() -> str:
    """Return inject-ready CSS for Streamlit application."""
    return f"""
    <style>
        /* Global Typography & Font Family */
        @import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600&family=Inter:wght@300;400;500;600;700&display=swap');

        html, body, [class*="css"] {{
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            color: {THEME_COLORS['text_primary']};
        }}

        code, pre {{
            font-family: 'Fira Code', monospace !important;
        }}

        /* App Background */
        .stApp {{
            background-color: {THEME_COLORS['background']};
        }}

        /* Main Container Padding */
        .main .block-container {{
            padding-top: 2rem;
            padding-bottom: 3rem;
            max-width: 1200px;
        }}

        /* Custom KPI Metric Cards */
        .odl-kpi-card {{
            background: {THEME_COLORS['surface']};
            border: 1px solid {THEME_COLORS['border']};
            border-radius: 10px;
            padding: 18px 20px;
            box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
            transition: transform 0.15s ease, box-shadow 0.15s ease;
            margin-bottom: 12px;
        }}
        .odl-kpi-card:hover {{
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
            border-color: {THEME_COLORS['border_subtle']};
        }}
        .odl-kpi-label {{
            font-size: 0.8rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: {THEME_COLORS['text_secondary']};
            margin-bottom: 4px;
        }}
        .odl-kpi-value {{
            font-size: 1.75rem;
            font-weight: 700;
            color: {THEME_COLORS['primary']};
            line-height: 1.2;
        }}
        .odl-kpi-subtext {{
            font-size: 0.8rem;
            color: {THEME_COLORS['text_muted']};
            margin-top: 4px;
        }}

        /* Alert / Recommendation Banners */
        .odl-alert {{
            border-radius: 8px;
            padding: 14px 18px;
            margin-bottom: 14px;
            border-left: 4px solid;
            font-size: 0.92rem;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
        }}
        .odl-alert-warning {{
            background-color: {THEME_COLORS['warning_bg']};
            border-color: {THEME_COLORS['warning']};
            color: #92400E;
        }}
        .odl-alert-danger {{
            background-color: {THEME_COLORS['danger_bg']};
            border-color: {THEME_COLORS['danger']};
            color: #991B1B;
        }}
        .odl-alert-info {{
            background-color: {THEME_COLORS['info_bg']};
            border-color: {THEME_COLORS['info']};
            color: #075985;
        }}
        .odl-alert-success {{
            background-color: {THEME_COLORS['success_bg']};
            border-color: {THEME_COLORS['success']};
            color: #065F46;
        }}
        .odl-alert-title {{
            font-weight: 600;
            font-size: 0.96rem;
            margin-bottom: 3px;
        }}

        /* Badges */
        .odl-badge {{
            display: inline-block;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 0.75rem;
            font-weight: 600;
            letter-spacing: 0.02em;
        }}
        .odl-badge-primary {{
            background-color: #DBEAFE;
            color: {THEME_COLORS['primary']};
        }}
        .odl-badge-accent {{
            background-color: #FEF3C7;
            color: {THEME_COLORS['accent_hover']};
        }}
        .odl-badge-success {{
            background-color: {THEME_COLORS['success_bg']};
            color: {THEME_COLORS['success']};
        }}

        /* Header Banner */
        .odl-header-banner {{
            background: linear-gradient(135deg, {THEME_COLORS['primary_dark']} 0%, {THEME_COLORS['primary']} 100%);
            color: #FFFFFF;
            padding: 24px 28px;
            border-radius: 12px;
            margin-bottom: 24px;
            box-shadow: 0 4px 14px rgba(30, 64, 175, 0.15);
        }}
        .odl-header-banner h1 {{
            color: #FFFFFF !important;
            font-size: 1.9rem !important;
            font-weight: 700 !important;
            margin: 0 0 6px 0 !important;
        }}
        .odl-header-banner p {{
            color: #E2E8F0 !important;
            font-size: 0.95rem !important;
            margin: 0 !important;
        }}

        /* Empty State Containers */
        .odl-empty-state {{
            background: {THEME_COLORS['surface']};
            border: 2px dashed {THEME_COLORS['border']};
            border-radius: 12px;
            padding: 40px 24px;
            text-align: center;
            margin: 20px 0;
        }}
        .odl-empty-title {{
            font-size: 1.15rem;
            font-weight: 600;
            color: {THEME_COLORS['text_primary']};
            margin-bottom: 8px;
        }}
        .odl-empty-desc {{
            font-size: 0.9rem;
            color: {THEME_COLORS['text_secondary']};
            max-width: 500px;
            margin: 0 auto 16px auto;
        }}

        /* Champion Highlight Card */
        .odl-champion-card {{
            background: linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%);
            border: 2px solid {THEME_COLORS['accent']};
            border-radius: 12px;
            padding: 20px 24px;
            margin-bottom: 20px;
            box-shadow: 0 4px 12px rgba(217, 119, 6, 0.12);
        }}

        /* Sidebar Styling */
        section[data-testid="stSidebar"] {{
            background-color: #FFFFFF !important;
            border-right: 1px solid {THEME_COLORS['border']} !important;
        }}
        section[data-testid="stSidebar"] .block-container {{
            padding-top: 2rem !important;
        }}

        /* Buttons Customization */
        .stButton>button {{
            border-radius: 8px !important;
            font-weight: 600 !important;
            transition: all 0.15s ease !important;
        }}
        .stButton>button:hover {{
            border-color: {THEME_COLORS['primary_light']} !important;
            color: {THEME_COLORS['primary_dark']} !important;
        }}
    </style>
    """
