"""
Report Generator and Model Artifact Export Engine for OpenDataLens
Creates professional, self-contained HTML, JSON, and Markdown evaluation reports,
and packages fitted Scikit-learn pipelines with serialization metadata.
"""

import io
import json
from datetime import datetime
from typing import Dict, Any, Tuple
import joblib

from core.config import THEME_COLORS, APP_NAME, APP_VERSION


def generate_html_report(
    dataset_meta: Dict[str, Any],
    quality_summary: Dict[str, Any],
    model_evaluations: Dict[str, Dict[str, Any]],
    best_model_info: Dict[str, Any],
    problem_type: str = "classification"
) -> str:
    """
    Generate an executive-ready, responsive, self-contained HTML report.
    Adheres to UI/UX Pro Max styling tokens.
    """
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    ds_name = dataset_meta.get("name", "Dataset")
    ds_rows = quality_summary.get("overview", {}).get("total_rows", "N/A")
    ds_cols = quality_summary.get("overview", {}).get("total_cols", "N/A")
    completeness = quality_summary.get("overview", {}).get("completeness_score", 100.0)
    duplicates = quality_summary.get("overview", {}).get("duplicate_rows", 0)

    best_name = best_model_info.get("name", "None")
    best_metric = best_model_info.get("metric", "Primary Metric")
    best_score = best_model_info.get("score", 0.0)

    # Build model table rows
    table_rows = []
    for model_key, ev in model_evaluations.items():
        m_name = ev.get("model_name", model_key)
        metrics = ev.get("metrics", {})
        t_time = ev.get("fit_time", 0.0)

        is_champion = (m_name == best_name)
        row_class = "champion-row" if is_champion else ""
        badge = "<span class='badge-champion'>Champion</span>" if is_champion else ""

        if problem_type == "classification":
            acc = metrics.get("accuracy", 0.0)
            f1 = metrics.get("f1_macro", 0.0)
            prec = metrics.get("precision_macro", 0.0)
            rec = metrics.get("recall_macro", 0.0)
            table_rows.append(f"""
            <tr class="{row_class}">
                <td><strong>{m_name}</strong> {badge}</td>
                <td>{acc:.4f}</td>
                <td><strong>{f1:.4f}</strong></td>
                <td>{prec:.4f}</td>
                <td>{rec:.4f}</td>
                <td>{t_time:.3f}s</td>
            </tr>
            """)
        else:
            r2 = metrics.get("r2", 0.0)
            rmse = metrics.get("rmse", 0.0)
            mae = metrics.get("mae", 0.0)
            mse = metrics.get("mse", 0.0)
            table_rows.append(f"""
            <tr class="{row_class}">
                <td><strong>{m_name}</strong> {badge}</td>
                <td><strong>{r2:.4f}</strong></td>
                <td>{rmse:.4f}</td>
                <td>{mae:.4f}</td>
                <td>{mse:.4f}</td>
                <td>{t_time:.3f}s</td>
            </tr>
            """)

    metric_headers = (
        "<th>Accuracy</th><th>F1 (Macro)</th><th>Precision</th><th>Recall</th>"
        if problem_type == "classification"
        else "<th>R² Score</th><th>RMSE</th><th>MAE</th><th>MSE</th>"
    )

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{APP_NAME} — {ds_name} Evaluation Report</title>
    <style>
        :root {{
            --primary: {THEME_COLORS['primary']};
            --primary-dark: {THEME_COLORS['primary_dark']};
            --secondary: {THEME_COLORS['secondary']};
            --accent: {THEME_COLORS['accent']};
            --bg: {THEME_COLORS['background']};
            --surface: {THEME_COLORS['surface']};
            --text-main: {THEME_COLORS['text_primary']};
            --text-muted: {THEME_COLORS['text_secondary']};
            --border: {THEME_COLORS['border']};
            --success: {THEME_COLORS['success']};
        }}
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: var(--bg);
            color: var(--text-main);
            line-height: 1.5;
            padding: 32px 16px;
        }}
        .container {{
            max-width: 1040px;
            margin: 0 auto;
        }}
        .header {{
            background: linear-gradient(135deg, var(--primary-dark) 0%, var(--primary) 100%);
            color: #FFFFFF;
            padding: 32px;
            border-radius: 12px;
            margin-bottom: 24px;
            box-shadow: 0 4px 12px rgba(30, 64, 175, 0.15);
        }}
        .header h1 {{ font-size: 28px; font-weight: 700; margin-bottom: 8px; }}
        .header p {{ color: #E2E8F0; font-size: 14px; }}
        
        .grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
        }}
        .kpi-card {{
            background: var(--surface);
            padding: 20px;
            border-radius: 10px;
            border: 1px solid var(--border);
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        }}
        .kpi-card .label {{ font-size: 13px; color: var(--text-muted); font-weight: 500; text-transform: uppercase; }}
        .kpi-card .value {{ font-size: 24px; font-weight: 700; color: var(--primary); margin-top: 6px; }}
        
        .section-card {{
            background: var(--surface);
            padding: 24px;
            border-radius: 10px;
            border: 1px solid var(--border);
            margin-bottom: 24px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        }}
        .section-card h2 {{
            font-size: 18px;
            color: var(--primary-dark);
            border-bottom: 2px solid var(--border);
            padding-bottom: 8px;
            margin-bottom: 16px;
        }}
        
        table {{
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
        }}
        th, td {{
            padding: 12px 14px;
            text-align: left;
            border-bottom: 1px solid var(--border);
        }}
        th {{
            background-color: #F8FAFC;
            color: var(--text-muted);
            font-weight: 600;
        }}
        tr:hover {{ background-color: #F8FAFC; }}
        .champion-row {{
            background-color: #FEF3C7 !important;
        }}
        .badge-champion {{
            background: var(--accent);
            color: #000000;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 700;
            margin-left: 6px;
        }}
        .footer {{
            text-align: center;
            font-size: 12px;
            color: var(--text-muted);
            margin-top: 32px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{APP_NAME} — Model Evaluation Report</h1>
            <p>Dataset: <strong>{ds_name}</strong> | Task: <strong>{problem_type.capitalize()}</strong> | Generated: {timestamp}</p>
        </div>

        <div class="grid">
            <div class="kpi-card">
                <div class="label">Dataset Size</div>
                <div class="value">{ds_rows} × {ds_cols}</div>
            </div>
            <div class="kpi-card">
                <div class="label">Completeness Score</div>
                <div class="value">{completeness}%</div>
            </div>
            <div class="kpi-card">
                <div class="label">Models Evaluated</div>
                <div class="value">{len(model_evaluations)}</div>
            </div>
            <div class="kpi-card">
                <div class="label">Champion Model</div>
                <div class="value" style="font-size: 18px; color: var(--accent);">{best_name}</div>
            </div>
        </div>

        <div class="section-card">
            <h2>Model Performance Scoreboard</h2>
            <table>
                <thead>
                    <tr>
                        <th>Algorithm</th>
                        {metric_headers}
                        <th>Train Time</th>
                    </tr>
                </thead>
                <tbody>
                    {''.join(table_rows)}
                </tbody>
            </table>
        </div>

        <div class="section-card">
            <h2>Data Quality & Preprocessing Highlights</h2>
            <p><strong>Completeness:</strong> {completeness}% | <strong>Duplicate Rows:</strong> {duplicates} | <strong>Source:</strong> {dataset_meta.get('source', 'CSV')}</p>
            <p style="margin-top: 8px; color: var(--text-muted);">
                Preprocessing was conducted using leak-free scikit-learn pipelines with median imputation and scaling for numerical features, and mode imputation with one-hot encoding for categorical features.
            </p>
        </div>

        <div class="footer">
            Generated autonomously by {APP_NAME} v{APP_VERSION} &bull; Portfolio Machine Learning Platform
        </div>
    </div>
</body>
</html>
"""
    return html_content


def generate_json_report(
    dataset_meta: Dict[str, Any],
    quality_summary: Dict[str, Any],
    model_evaluations: Dict[str, Dict[str, Any]],
    best_model_info: Dict[str, Any],
    problem_type: str = "classification"
) -> str:
    """Generate structured JSON report for programmatic consumption."""
    payload = {
        "platform": APP_NAME,
        "version": APP_VERSION,
        "generated_at": datetime.now().isoformat(),
        "problem_type": problem_type,
        "dataset": dataset_meta,
        "data_quality_summary": quality_summary.get("overview", {}),
        "best_model": best_model_info,
        "models": model_evaluations
    }
    return json.dumps(payload, indent=2)


def generate_markdown_report(
    dataset_meta: Dict[str, Any],
    quality_summary: Dict[str, Any],
    model_evaluations: Dict[str, Dict[str, Any]],
    best_model_info: Dict[str, Any],
    problem_type: str = "classification"
) -> str:
    """Generate Markdown evaluation report for GitHub or README consumption."""
    lines = [
        f"# {APP_NAME} Evaluation Report",
        f"**Dataset:** {dataset_meta.get('name', 'N/A')} | **Task:** {problem_type.capitalize()} | **Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M')}\n",
        "## Summary",
        f"- **Rows:** {quality_summary.get('overview', {}).get('total_rows', 'N/A')}",
        f"- **Columns:** {quality_summary.get('overview', {}).get('total_cols', 'N/A')}",
        f"- **Completeness Score:** {quality_summary.get('overview', {}).get('completeness_score', 'N/A')}%",
        f"- **Best Model:** **{best_model_info.get('name', 'N/A')}** ({best_model_info.get('metric', 'Metric')}: {best_model_info.get('score', 0.0):.4f})\n",
        "## Performance Comparison\n"
    ]

    if problem_type == "classification":
        lines.append("| Model | Accuracy | F1 (Macro) | Precision | Recall | Fit Time |")
        lines.append("| :--- | :---: | :---: | :---: | :---: | :---: |")
        for m_key, ev in model_evaluations.items():
            name = ev.get("model_name", m_key)
            m = ev.get("metrics", {})
            t = ev.get("fit_time", 0.0)
            lines.append(f"| {name} | {m.get('accuracy', 0.0):.4f} | {m.get('f1_macro', 0.0):.4f} | {m.get('precision_macro', 0.0):.4f} | {m.get('recall_macro', 0.0):.4f} | {t:.3f}s |")
    else:
        lines.append("| Model | R² Score | RMSE | MAE | MSE | Fit Time |")
        lines.append("| :--- | :---: | :---: | :---: | :---: | :---: |")
        for m_key, ev in model_evaluations.items():
            name = ev.get("model_name", m_key)
            m = ev.get("metrics", {})
            t = ev.get("fit_time", 0.0)
            lines.append(f"| {name} | {m.get('r2', 0.0):.4f} | {m.get('rmse', 0.0):.4f} | {m.get('mae', 0.0):.4f} | {m.get('mse', 0.0):.4f} | {t:.3f}s |")

    return "\n".join(lines)


def export_model_pipeline_bytes(
    pipeline: Any,
    metadata: Dict[str, Any]
) -> bytes:
    """
    Serialize a Scikit-learn Pipeline with comprehensive metadata using joblib.
    Returns bytes buffer for download.
    """
    buffer = io.BytesIO()
    payload = {
        "pipeline": pipeline,
        "metadata": metadata,
        "exported_at": datetime.now().isoformat(),
        "platform": APP_NAME,
        "version": APP_VERSION
    }
    joblib.dump(payload, buffer, compress=3)
    buffer.seek(0)
    return buffer.getvalue()
