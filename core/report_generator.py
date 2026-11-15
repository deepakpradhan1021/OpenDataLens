"""
Report Generator and Model Artifact Export Engine for OpenDataLens
Creates professional, self-contained HTML, PDF, JSON, and Markdown evaluation reports,
multi-sheet Excel dossiers, and packages fitted Scikit-learn pipelines with serialization metadata.
"""

import io
import json
import html
from datetime import datetime
from typing import Dict, Any, List, Optional
import joblib
import pandas as pd

from reportlab.lib.pagesizes import letter
from reportlab.lib.colors import HexColor
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    KeepTogether,
    HRFlowable,
    PageBreak
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

from core.config import THEME_COLORS, APP_NAME, APP_VERSION


class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas to calculate total page count and render
    professional headers and footers on every page.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(HexColor("#64748B"))

        # Running top header on pages 2+
        if self._pageNumber > 1:
            self.setStrokeColor(HexColor("#E2E8F0"))
            self.setLineWidth(0.5)
            self.line(36, 756, 576, 756)
            self.drawString(36, 762, f"{APP_NAME} — Executive Analytics & Audit Report")
            self.drawRightString(576, 762, datetime.now().strftime("%B %d, %Y"))

        # Running footer on all pages
        self.setStrokeColor(HexColor("#E2E8F0"))
        self.setLineWidth(0.5)
        self.line(36, 36, 576, 36)
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(576, 24, page_str)
        self.drawString(36, 24, f"{APP_NAME} v{APP_VERSION} • Confidential Analytics & Audit Dossier")
        self.restoreState()


def generate_pdf_report(
    df: Optional[pd.DataFrame],
    dataset_meta: Dict[str, Any],
    quality_summary: Optional[Dict[str, Any]] = None,
    model_evaluations: Optional[Dict[str, Dict[str, Any]]] = None,
    best_model_info: Optional[Dict[str, Any]] = None,
    problem_type: str = "classification",
    sections: Optional[List[str]] = None,
    clean_history: Optional[List[Dict[str, Any]]] = None
) -> bytes:
    """
    Generate an executive-ready, high-density, multi-page PDF report.
    Adheres to OpenDataLens Emerald Design Tokens.
    """
    if not sections:
        sections = ["summary", "quality", "cleaning", "ml", "dictionary", "sample"]

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=42,
        bottomMargin=42
    )

    styles = getSampleStyleSheet()
    
    # Custom Brand Paragraph Styles
    title_style = ParagraphStyle(
        "CoverTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=20,
        leading=24,
        textColor=HexColor("#064E3B")  # Emerald 900
    )
    subtitle_style = ParagraphStyle(
        "CoverSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        textColor=HexColor("#047857")  # Emerald 700
    )
    h2_style = ParagraphStyle(
        "SectionH2",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=16,
        textColor=HexColor("#064E3B"),
        spaceBefore=14,
        spaceAfter=6
    )
    body_style = ParagraphStyle(
        "ReportBody",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=12,
        textColor=HexColor("#1E293B")
    )
    bold_style = ParagraphStyle(
        "ReportBold",
        parent=body_style,
        fontName="Helvetica-Bold"
    )
    kpi_num_style = ParagraphStyle(
        "KpiNum",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=16,
        leading=20,
        textColor=HexColor("#059669"),
        alignment=1
    )
    kpi_lbl_style = ParagraphStyle(
        "KpiLbl",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=10,
        textColor=HexColor("#64748B"),
        alignment=1
    )
    th_style = ParagraphStyle(
        "TableHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=11,
        textColor=HexColor("#FFFFFF")
    )
    td_style = ParagraphStyle(
        "TableCell",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=10,
        textColor=HexColor("#1E293B")
    )

    story = []

    # Title & Metadata Banner
    ds_name = html.escape(str(dataset_meta.get("name", "Active Dataset")))
    ds_source = html.escape(str(dataset_meta.get("source", dataset_meta.get("format", "In-Memory"))))
    total_rows = len(df) if df is not None else dataset_meta.get("total_rows", 0)
    total_cols = len(df.columns) if df is not None else dataset_meta.get("total_columns", 0)
    timestamp_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    story.append(Paragraph(f"{APP_NAME} — Executive Evaluation Report", title_style))
    story.append(Paragraph(
        f"Dataset: <b>{ds_name}</b> &bull; Source: <b>{ds_source}</b> &bull; Task: <b>{html.escape(problem_type.capitalize())}</b> &bull; Exported: <b>{timestamp_str}</b>",
        subtitle_style
    ))
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=1.5, color=HexColor("#10B981"), spaceAfter=14))

    # SECTION 1: EXECUTIVE KPI SUMMARY
    if "summary" in sections:
        q_overview = (quality_summary or {}).get("overview", {})
        comp_score = q_overview.get("completeness_score", 100.0)
        health_score = q_overview.get("health_score", 100.0)
        dup_rows = q_overview.get("duplicate_rows", 0)
        champ_name = html.escape(str((best_model_info or {}).get("name", "N/A" if not model_evaluations else "Evaluating...")))

        kpi_table_data = [
            [
                Paragraph(f"{total_rows} × {total_cols}", kpi_num_style),
                Paragraph(f"{comp_score:.1f}%", kpi_num_style),
                Paragraph(f"{health_score:.1f}%", kpi_num_style),
                Paragraph(f"{champ_name[:16]}", kpi_num_style)
            ],
            [
                Paragraph("DATASET DIMENSIONS", kpi_lbl_style),
                Paragraph("COMPLETENESS SCORE", kpi_lbl_style),
                Paragraph("HEALTH SCORE", kpi_lbl_style),
                Paragraph("CHAMPION MODEL", kpi_lbl_style)
            ]
        ]
        kpi_table = Table(kpi_table_data, colWidths=[135, 135, 135, 135])
        kpi_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), HexColor("#F0FDF4")),
            ("BOX", (0, 0), (-1, -1), 1, HexColor("#86EFAC")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, HexColor("#DCFCE7")),
            ("TOPPADDING", (0, 0), (-1, 0), 8),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 2),
            ("TOPPADDING", (0, 1), (-1, 1), 2),
            ("BOTTOMPADDING", (0, 1), (-1, 1), 8),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ]))
        story.append(kpi_table)
        story.append(Spacer(1, 12))

    # SECTION 2: DATA QUALITY & STRUCTURAL HEALTH
    if "quality" in sections and quality_summary:
        q_overview = quality_summary.get("overview", {})
        story.append(Paragraph("1. Data Quality & Structural Health Audit", h2_style))

        q_metrics_data = [
            [Paragraph("Quality Metric", th_style), Paragraph("Observed Value", th_style), Paragraph("Benchmark / Status", th_style)],
            [Paragraph("Completeness Score", td_style), Paragraph(f"{q_overview.get('completeness_score', 100):.2f}%", td_style), Paragraph("Optimal (>= 90%)" if q_overview.get("completeness_score", 100) >= 90 else "Action Recommended", td_style)],
            [Paragraph("Data Health Score", td_style), Paragraph(f"{q_overview.get('health_score', 100):.2f}%", td_style), Paragraph("Pass" if q_overview.get("health_score", 100) >= 80 else "Attention Required", td_style)],
            [Paragraph("Duplicate Rows", td_style), Paragraph(f"{q_overview.get('duplicate_rows', 0)}", td_style), Paragraph("0 duplicates optimal", td_style)],
            [Paragraph("Missing Cell Count", td_style), Paragraph(f"{q_overview.get('missing_cells', 0)}", td_style), Paragraph("Clean" if q_overview.get("missing_cells", 0) == 0 else "Imputed", td_style)],
            [Paragraph("Constant / Zero-Variance Cols", td_style), Paragraph(f"{q_overview.get('constant_columns', 0)}", td_style), Paragraph("None" if q_overview.get("constant_columns", 0) == 0 else "Dropped", td_style)],
        ]
        q_table = Table(q_metrics_data, colWidths=[180, 180, 180])
        q_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), HexColor("#064E3B")),
            ("BOX", (0, 0), (-1, -1), 0.5, HexColor("#CBD5E1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, HexColor("#E2E8F0")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [HexColor("#FFFFFF"), HexColor("#F8FAFC")]),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(q_table)
        story.append(Spacer(1, 10))

    # SECTION 3: DATA CLEANING LINEAGE
    if "cleaning" in sections and clean_history and len(clean_history) > 0:
        story.append(Paragraph("2. Data Cleaning & Transformation Lineage", h2_style))
        clean_rows = [
            [Paragraph("#", th_style), Paragraph("Action", th_style), Paragraph("Target Columns", th_style), Paragraph("Parameters", th_style), Paragraph("Timestamp", th_style)]
        ]
        for idx, step in enumerate(clean_history[:10], start=1):
            act = html.escape(str(step.get("action", "Transformation")))
            col = html.escape(str(step.get("column", step.get("columns", "All"))))
            params = html.escape(str(step.get("params", {})) if step.get("params") else "Default")
            tstamp = html.escape(str(step.get("timestamp", ""))[:19])
            clean_rows.append([
                Paragraph(str(idx), td_style),
                Paragraph(act, td_style),
                Paragraph(col[:30], td_style),
                Paragraph(params[:35], td_style),
                Paragraph(tstamp, td_style)
            ])
        c_table = Table(clean_rows, colWidths=[25, 120, 140, 155, 100])
        c_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), HexColor("#047857")),
            ("BOX", (0, 0), (-1, -1), 0.5, HexColor("#CBD5E1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, HexColor("#E2E8F0")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [HexColor("#FFFFFF"), HexColor("#F8FAFC")]),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(c_table)
        story.append(Spacer(1, 10))

    # SECTION 4: MACHINE LEARNING BENCHMARK
    if "ml" in sections:
        story.append(Paragraph("3. Machine Learning Model Leaderboard", h2_style))
        if model_evaluations and len(model_evaluations) > 0:
            best_name = (best_model_info or {}).get("name")
            if problem_type == "classification":
                ml_rows = [
                    [
                        Paragraph("Model Architecture", th_style),
                        Paragraph("Accuracy", th_style),
                        Paragraph("F1 (Macro)", th_style),
                        Paragraph("Precision", th_style),
                        Paragraph("Recall", th_style),
                        Paragraph("Fit Time", th_style)
                    ]
                ]
                for k, ev in model_evaluations.items():
                    m_name = html.escape(str(ev.get("model_name", k)))
                    is_champ = (m_name == best_name)
                    badge = " ★ [CHAMPION]" if is_champ else ""
                    m = ev.get("metrics", {})
                    t = ev.get("fit_time", 0.0)
                    ml_rows.append([
                        Paragraph(f"<b>{m_name}</b>{badge}", td_style),
                        Paragraph(f"{m.get('accuracy', 0.0):.4f}", td_style),
                        Paragraph(f"<b>{m.get('f1_macro', 0.0):.4f}</b>", td_style),
                        Paragraph(f"{m.get('precision_macro', 0.0):.4f}", td_style),
                        Paragraph(f"{m.get('recall_macro', 0.0):.4f}", td_style),
                        Paragraph(f"{t:.3f}s", td_style)
                    ])
                ml_table = Table(ml_rows, colWidths=[160, 75, 80, 75, 75, 75])
            else:
                ml_rows = [
                    [
                        Paragraph("Model Architecture", th_style),
                        Paragraph("R² Score", th_style),
                        Paragraph("RMSE", th_style),
                        Paragraph("MAE", th_style),
                        Paragraph("MSE", th_style),
                        Paragraph("Fit Time", th_style)
                    ]
                ]
                for k, ev in model_evaluations.items():
                    m_name = html.escape(str(ev.get("model_name", k)))
                    is_champ = (m_name == best_name)
                    badge = " ★ [CHAMPION]" if is_champ else ""
                    m = ev.get("metrics", {})
                    t = ev.get("fit_time", 0.0)
                    ml_rows.append([
                        Paragraph(f"<b>{m_name}</b>{badge}", td_style),
                        Paragraph(f"<b>{m.get('r2', 0.0):.4f}</b>", td_style),
                        Paragraph(f"{m.get('rmse', 0.0):.4f}", td_style),
                        Paragraph(f"{m.get('mae', 0.0):.4f}", td_style),
                        Paragraph(f"{m.get('mse', 0.0):.4f}", td_style),
                        Paragraph(f"{t:.3f}s", td_style)
                    ])
                ml_table = Table(ml_rows, colWidths=[160, 75, 80, 75, 75, 75])

            ml_table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), HexColor("#064E3B")),
                ("BOX", (0, 0), (-1, -1), 0.5, HexColor("#CBD5E1")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, HexColor("#E2E8F0")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [HexColor("#FFFFFF"), HexColor("#F8FAFC")]),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]))
            story.append(ml_table)
        else:
            story.append(Paragraph(
                "<i>No machine learning models have been trained in this session yet. Baseline algorithms can be trained in the ML Studio tab.</i>",
                body_style
            ))
        story.append(Spacer(1, 10))

    # SECTION 5: DATA DICTIONARY & SCHEMA
    if "dictionary" in sections and df is not None:
        story.append(Paragraph("4. Feature Dictionary & Data Types", h2_style))
        dict_rows = [
            [
                Paragraph("Column Name", th_style),
                Paragraph("Inferred Type", th_style),
                Paragraph("Non-Null Count", th_style),
                Paragraph("Null %", th_style),
                Paragraph("Unique Values", th_style)
            ]
        ]
        for col in list(df.columns)[:15]:
            null_pct = float(df[col].isna().mean() * 100)
            dict_rows.append([
                Paragraph(html.escape(str(col)), td_style),
                Paragraph(html.escape(str(df[col].dtype)), td_style),
                Paragraph(f"{int(df[col].notna().sum())}", td_style),
                Paragraph(f"{null_pct:.1f}%", td_style),
                Paragraph(f"{int(df[col].nunique())}", td_style)
            ])
        d_table = Table(dict_rows, colWidths=[160, 95, 95, 95, 95])
        d_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), HexColor("#064E3B")),
            ("BOX", (0, 0), (-1, -1), 0.5, HexColor("#CBD5E1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, HexColor("#E2E8F0")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [HexColor("#FFFFFF"), HexColor("#F8FAFC")]),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]))
        story.append(d_table)
        story.append(Spacer(1, 10))

    # SECTION 6: DATA SAMPLE (TOP 5 ROWS)
    if "sample" in sections and df is not None and not df.empty:
        story.append(Paragraph("5. Data Sample (Top 5 Rows)", h2_style))
        preview_cols = list(df.columns)[:6]
        samp_header = [Paragraph(html.escape(str(c)[:14]), th_style) for c in preview_cols]
        samp_rows = [samp_header]

        for _, row in df.head(5).iterrows():
            row_cells = []
            for c in preview_cols:
                val_str = str(row[c])
                if len(val_str) > 18:
                    val_str = val_str[:16] + ".."
                row_cells.append(Paragraph(html.escape(val_str), td_style))
            samp_rows.append(row_cells)

        col_w = 540 / len(preview_cols)
        s_table = Table(samp_rows, colWidths=[col_w] * len(preview_cols))
        s_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), HexColor("#047857")),
            ("BOX", (0, 0), (-1, -1), 0.5, HexColor("#CBD5E1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, HexColor("#E2E8F0")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [HexColor("#FFFFFF"), HexColor("#F8FAFC")]),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]))
        story.append(s_table)
        story.append(Spacer(1, 10))

    doc.build(story, canvasmaker=NumberedCanvas)
    buffer.seek(0)
    return buffer.getvalue()


def generate_html_report(
    dataset_meta: Dict[str, Any],
    quality_summary: Optional[Dict[str, Any]] = None,
    model_evaluations: Optional[Dict[str, Dict[str, Any]]] = None,
    best_model_info: Optional[Dict[str, Any]] = None,
    problem_type: str = "classification",
    clean_history: Optional[List[Dict[str, Any]]] = None,
    sections: Optional[List[str]] = None
) -> str:
    """
    Generate an executive-ready, responsive, self-contained HTML report.
    Adheres to Emerald Design Tokens.
    """
    if not sections:
        sections = ["summary", "quality", "cleaning", "ml"]

    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    ds_name = html.escape(str(dataset_meta.get("name", "Dataset")))
    ds_source = html.escape(str(dataset_meta.get("source", "CSV / Upload")))
    task_type = html.escape(str(problem_type).capitalize())
    q_overview = (quality_summary or {}).get("overview", {})
    ds_rows = q_overview.get("total_rows", dataset_meta.get("total_rows", "N/A"))
    ds_cols = q_overview.get("total_cols", dataset_meta.get("total_columns", "N/A"))
    completeness = q_overview.get("completeness_score", 100.0)
    duplicates = q_overview.get("duplicate_rows", 0)

    best_name = html.escape(str((best_model_info or {}).get("name", "None")))
    eval_dict = model_evaluations or {}

    # Build model table rows if models present
    table_rows = []
    if "ml" in sections and eval_dict:
        for model_key, ev in eval_dict.items():
            m_name = html.escape(str(ev.get("model_name", model_key)))
            metrics = ev.get("metrics", {})
            t_time = ev.get("fit_time", 0.0)

            is_champion = (m_name == best_name)
            row_class = "champion-row" if is_champion else ""
            badge = "<span class='badge-champion'>★ Champion</span>" if is_champion else ""

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

    # Clean history rows
    cleaning_html = ""
    if "cleaning" in sections and clean_history and len(clean_history) > 0:
        c_rows = []
        for i, step in enumerate(clean_history, 1):
            act_name = html.escape(str(step.get('action', 'Transform')))
            col_name = html.escape(str(step.get('column', step.get('columns', 'All'))))
            params_repr = html.escape(json.dumps(step.get('params', {}), default=str) if isinstance(step.get('params'), (dict, list)) else str(step.get('params', 'Default')))
            tstamp_repr = html.escape(str(step.get('timestamp', ''))[:19])
            c_rows.append(f"""
            <tr>
                <td>{i}</td>
                <td><strong>{act_name}</strong></td>
                <td><code>{col_name}</code></td>
                <td>{params_repr}</td>
                <td>{tstamp_repr}</td>
            </tr>
            """)
        cleaning_html = f"""
        <div class="section-card">
            <h2>Data Cleaning & Transformation Lineage</h2>
            <table>
                <thead>
                    <tr><th>#</th><th>Action</th><th>Target</th><th>Parameters</th><th>Timestamp</th></tr>
                </thead>
                <tbody>
                    {''.join(c_rows)}
                </tbody>
            </table>
        </div>
        """

    # ML section HTML
    ml_html = ""
    if "ml" in sections:
        if eval_dict:
            ml_html = f"""
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
            """
        else:
            ml_html = """
            <div class="section-card">
                <h2>Model Performance Scoreboard</h2>
                <p style="color: #64748B; font-style: italic;">
                    No models evaluated yet in this session. Models can be benchmarked via the ML Studio.
                </p>
            </div>
            """

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{APP_NAME} — {ds_name} Executive Report</title>
    <style>
        :root {{
            --primary: #059669;
            --primary-dark: #064E3B;
            --secondary: #10B981;
            --accent: #F59E0B;
            --bg: #F8FAFC;
            --surface: #FFFFFF;
            --text-main: #0F172A;
            --text-muted: #64748B;
            --border: #E2E8F0;
            --success: #10B981;
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
            border-radius: 14px;
            margin-bottom: 24px;
            box-shadow: 0 4px 14px rgba(5, 150, 105, 0.2);
        }}
        .header h1 {{ font-size: 28px; font-weight: 700; margin-bottom: 8px; }}
        .header p {{ color: #D1FAE5; font-size: 14px; }}
        
        .grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
        }}
        .kpi-card {{
            background: var(--surface);
            padding: 20px;
            border-radius: 12px;
            border: 1px solid var(--border);
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        }}
        .kpi-card .label {{ font-size: 12px; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }}
        .kpi-card .value {{ font-size: 22px; font-weight: 700; color: var(--primary); margin-top: 6px; }}
        
        .section-card {{
            background: var(--surface);
            padding: 24px;
            border-radius: 12px;
            border: 1px solid var(--border);
            margin-bottom: 24px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        }}
        .section-card h2 {{
            font-size: 18px;
            color: var(--primary-dark);
            border-bottom: 2px solid var(--border);
            padding-bottom: 10px;
            margin-bottom: 16px;
        }}
        
        table {{
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
        }}
        th, td {{
            padding: 10px 14px;
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
            background-color: #ECFDF5 !important;
        }}
        .badge-champion {{
            background: #10B981;
            color: #FFFFFF;
            padding: 2px 8px;
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
            <h1>{APP_NAME} — Executive Evaluation Report</h1>
            <p>Dataset: <strong>{ds_name}</strong> | Task: <strong>{task_type}</strong> | Generated: {timestamp}</p>
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
                <div class="value">{len(eval_dict)}</div>
            </div>
            <div class="kpi-card">
                <div class="label">Champion Model</div>
                <div class="value" style="font-size: 16px; color: var(--primary-dark);">{best_name}</div>
            </div>
        </div>

        <div class="section-card">
            <h2>Data Quality & Preprocessing Highlights</h2>
            <p><strong>Completeness:</strong> {completeness}% | <strong>Duplicate Rows:</strong> {duplicates} | <strong>Source:</strong> {ds_source}</p>
            <p style="margin-top: 8px; color: var(--text-muted);">
                Data preprocessing pipeline applies isolated leakage-free transformations, median imputation for continuous numerical variables, and frequency-based encoding for discrete features.
            </p>
        </div>

        {cleaning_html}
        {ml_html}

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
    quality_summary: Optional[Dict[str, Any]] = None,
    model_evaluations: Optional[Dict[str, Dict[str, Any]]] = None,
    best_model_info: Optional[Dict[str, Any]] = None,
    problem_type: str = "classification",
    clean_history: Optional[List[Dict[str, Any]]] = None
) -> str:
    """Generate structured JSON report for programmatic consumption."""
    payload = {
        "platform": APP_NAME,
        "version": APP_VERSION,
        "generated_at": datetime.now().isoformat(),
        "problem_type": problem_type,
        "dataset": dataset_meta,
        "data_quality_summary": (quality_summary or {}).get("overview", {}),
        "clean_history": clean_history or [],
        "best_model": best_model_info or {},
        "models": model_evaluations or {}
    }
    return json.dumps(payload, indent=2, default=str)


def generate_markdown_report(
    dataset_meta: Dict[str, Any],
    quality_summary: Optional[Dict[str, Any]] = None,
    model_evaluations: Optional[Dict[str, Dict[str, Any]]] = None,
    best_model_info: Optional[Dict[str, Any]] = None,
    problem_type: str = "classification",
    clean_history: Optional[List[Dict[str, Any]]] = None
) -> str:
    """Generate Markdown evaluation report for GitHub or README consumption."""
    q_overview = (quality_summary or {}).get("overview", {})
    best_info = best_model_info or {}
    lines = [
        f"# {APP_NAME} Evaluation Report",
        f"**Dataset:** {dataset_meta.get('name', 'N/A')} | **Task:** {problem_type.capitalize()} | **Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M')}\n",
        "## Summary",
        f"- **Rows:** {q_overview.get('total_rows', dataset_meta.get('total_rows', 'N/A'))}",
        f"- **Columns:** {q_overview.get('total_cols', dataset_meta.get('total_columns', 'N/A'))}",
        f"- **Completeness Score:** {q_overview.get('completeness_score', 'N/A')}%",
    ]
    if best_info.get("name"):
        lines.append(f"- **Best Model:** **{best_info.get('name')}** ({best_info.get('metric', 'Metric')}: {best_info.get('score', 0.0):.4f})\n")

    if clean_history and len(clean_history) > 0:
        lines.append("## Data Cleaning Lineage\n")
        lines.append("| # | Action | Target Column | Parameters |")
        lines.append("| :- | :--- | :--- | :--- |")
        for i, step in enumerate(clean_history, 1):
            lines.append(f"| {i} | {step.get('action')} | {step.get('column', step.get('columns', 'All'))} | {step.get('params', {})} |")
        lines.append("\n")

    if model_evaluations and len(model_evaluations) > 0:
        lines.append("## Machine Learning Performance Comparison\n")
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


def generate_excel_workbook(
    df: Optional[pd.DataFrame],
    dataset_meta: Dict[str, Any],
    quality_summary: Optional[Dict[str, Any]] = None,
    model_evaluations: Optional[Dict[str, Dict[str, Any]]] = None,
    best_model_info: Optional[Dict[str, Any]] = None,
    problem_type: str = "classification",
    clean_history: Optional[List[Dict[str, Any]]] = None
) -> bytes:
    """
    Generate an executive multi-sheet Excel workbook (.xlsx) with:
    - Sheet 1: Overview (Metadata & General Properties)
    - Sheet 2: Column Dictionary (Data types, missing rates, cardinality)
    - Sheet 3: Quality Audit (Completeness, duplicate count, health metrics)
    - Sheet 4: Cleaning Lineage (Sequential audit trail of transformations)
    - Sheet 5: Model Leaderboard (All trained models, scores, champion)
    - Sheet 6: Data Sample (First 100 rows of dataset)
    """
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        # Sheet 1: Overview
        overview_data = [
            {"Property": "Dataset Name", "Value": dataset_meta.get("name", "Active Dataset")},
            {"Property": "Format / Source", "Value": dataset_meta.get("format", dataset_meta.get("source", "In-Memory"))},
            {"Property": "Total Rows", "Value": len(df) if df is not None else dataset_meta.get("total_rows", 0)},
            {"Property": "Total Columns", "Value": len(df.columns) if df is not None else dataset_meta.get("total_columns", 0)},
            {"Property": "Export Timestamp", "Value": datetime.now().strftime("%Y-%m-%d %H:%M:%S")},
            {"Property": "Platform", "Value": f"{APP_NAME} v{APP_VERSION}"},
        ]
        pd.DataFrame(overview_data).to_excel(writer, sheet_name="Overview", index=False)

        # Sheet 2: Column Dictionary
        if df is not None:
            col_summary = []
            for col in df.columns:
                col_summary.append({
                    "Column": col,
                    "Type": str(df[col].dtype),
                    "Missing Count": int(df[col].isna().sum()),
                    "Missing %": round(float(df[col].isna().mean() * 100), 2),
                    "Unique Values": int(df[col].nunique())
                })
            pd.DataFrame(col_summary).to_excel(writer, sheet_name="Column Dictionary", index=False)

        # Sheet 3: Quality Audit
        if quality_summary:
            q_overview = quality_summary.get("overview", {})
            quality_rows = [
                {"Metric": "Completeness Score (%)", "Value": q_overview.get("completeness_score", 100)},
                {"Metric": "Health Score (%)", "Value": q_overview.get("health_score", 100)},
                {"Metric": "Duplicate Rows", "Value": q_overview.get("duplicate_rows", 0)},
                {"Metric": "Missing Cells", "Value": q_overview.get("missing_cells", 0)},
                {"Metric": "Constant Columns", "Value": q_overview.get("constant_columns", 0)},
            ]
            pd.DataFrame(quality_rows).to_excel(writer, sheet_name="Quality Audit", index=False)

        # Sheet 4: Cleaning Lineage
        if clean_history and len(clean_history) > 0:
            c_rows = []
            for idx, c in enumerate(clean_history, 1):
                c_rows.append({
                    "Step": idx,
                    "Action": str(c.get("action", "")),
                    "Target Column(s)": str(c.get("column", c.get("columns", "All"))),
                    "Parameters": str(c.get("params", {})),
                    "Timestamp": str(c.get("timestamp", ""))
                })
            pd.DataFrame(c_rows).to_excel(writer, sheet_name="Cleaning Lineage", index=False)

        # Sheet 5: Model Leaderboard
        if model_evaluations:
            best_name = best_model_info.get("name") if best_model_info else None
            leaderboard_rows = []
            for k, ev in model_evaluations.items():
                m_name = ev.get("model_name", k)
                metrics = ev.get("metrics", {})
                row = {
                    "Model": m_name,
                    "Champion": "★ Champion" if m_name == best_name else "",
                    "Fit Time (s)": round(ev.get("fit_time", 0.0), 3)
                }
                for m_k, m_v in metrics.items():
                    if isinstance(m_v, (int, float)):
                        row[m_k] = round(m_v, 4)
                leaderboard_rows.append(row)
            pd.DataFrame(leaderboard_rows).to_excel(writer, sheet_name="Model Leaderboard", index=False)

        # Sheet 6: Data Sample
        if df is not None:
            df.head(100).to_excel(writer, sheet_name="Data Sample (Top 100)", index=False)

    buffer.seek(0)
    return buffer.getvalue()


def generate_project_state_json(session: Dict[str, Any]) -> str:
    """
    Generate an exportable JSON dossier capturing complete project session state.
    """
    comp_df = session.get("comparison_df")
    state = {
        "platform": APP_NAME,
        "version": APP_VERSION,
        "exported_at": datetime.now().isoformat(),
        "metadata": session.get("metadata", {}),
        "quality_analysis": session.get("quality_analysis", {}),
        "clean_history": session.get("clean_history", []),
        "ml_meta": session.get("ml_meta", {}),
        "model_evaluations": session.get("model_evaluations", {}),
        "comparison_table": comp_df.to_dict(orient="records") if comp_df is not None else [],
        "clean_history_count": len(session.get("clean_history", []))
    }
    return json.dumps(state, indent=2, default=str)
