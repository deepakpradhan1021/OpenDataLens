"""
Dataset Context and Privacy Layer for OpenDataLens AI Analyst.
Extracts rich, compact, metadata-first statistical summaries without raw data exposure.
Enforces privacy boundaries and guards against prompt injection.
"""

import math
import re
from typing import Dict, Any, List, Optional
import pandas as pd
import numpy as np


def sanitize_string(val: Any, max_len: int = 100) -> str:
    """Sanitize strings from user datasets to prevent prompt injection or format breakage."""
    if val is None:
        return ""
    s = str(val).strip()
    # Remove control characters and backticks
    s = re.sub(r"[\r\n\t]+", " ", s)
    s = s.replace("`", "'").replace("<", "&lt;").replace(">", "&gt;")
    if len(s) > max_len:
        s = s[:max_len] + "..."
    return s


def build_dataset_context(
    df: Optional[pd.DataFrame],
    metadata: Optional[Dict[str, Any]] = None,
    quality_analysis: Optional[Dict[str, Any]] = None,
    ml_results: Optional[Dict[str, Any]] = None,
    share_sample_rows: bool = False,
    max_sample_rows: int = 3
) -> Dict[str, Any]:
    """
    Construct a compact, privacy-safe summary of the active dataset.
    Defaults to metadata-first; raw records are NEVER included unless share_sample_rows is True.
    """
    context: Dict[str, Any] = {
        "has_dataset": False,
        "name": "No Dataset Loaded",
        "rows": 0,
        "cols": 0,
        "columns": [],
        "numeric_summary": {},
        "categorical_summary": {},
        "correlations": [],
        "target_leakage_warnings": [],
        "quality_overview": {},
        "ml_summary": {},
        "sample_rows": [],
        "privacy_notice": "Metadata only. Zero raw data rows transmitted."
    }

    if metadata:
        context["has_dataset"] = True
        context["name"] = sanitize_string(metadata.get("name", "Active Dataset"))
        context["rows"] = int(metadata.get("rows", 0))
        context["cols"] = int(metadata.get("cols", 0))
        context["task"] = sanitize_string(metadata.get("task", "general analysis"))
        context["suggested_target"] = sanitize_string(metadata.get("suggested_target", ""))
        context["description"] = sanitize_string(metadata.get("description", ""), max_len=200)

    if quality_analysis:
        context["has_dataset"] = True
        missing = quality_analysis.get("missing_values", {})
        col_summary = missing.get("column_summary", {})
        if col_summary and not context["columns"]:
            for col_name, s in col_summary.items():
                context["columns"].append({
                    "name": col_name,
                    "type": "numeric" if "mean" in s else "feature",
                    "is_numeric": True,
                    "missing_count": s.get("missing_count", 0),
                    "missing_pct": s.get("missing_pct", 0.0),
                    "unique_values": 0
                })

    if ml_results:
        context["has_dataset"] = True

    if df is None or df.empty:
        return context

    context["has_dataset"] = True
    context["rows"] = int(df.shape[0])
    context["cols"] = int(df.shape[1])

    # Column specifications
    col_profiles = []
    num_cols = []
    cat_cols = []

    for col in df.columns:
        s_col = sanitize_string(col)
        dtype_str = str(df[col].dtype)
        null_count = int(df[col].isna().sum())
        null_pct = round((null_count / max(1, df.shape[0])) * 100, 2)
        n_unique = int(df[col].nunique(dropna=True))

        is_numeric = pd.api.types.is_numeric_dtype(df[col])
        if is_numeric:
            num_cols.append(col)
        else:
            cat_cols.append(col)

        col_profiles.append({
            "name": s_col,
            "type": dtype_str,
            "is_numeric": is_numeric,
            "missing_count": null_count,
            "missing_pct": null_pct,
            "unique_values": n_unique
        })

    context["columns"] = col_profiles

    # Numerical feature statistical summaries (mean, std, min, median, max, skew)
    numeric_summary = {}
    for col in num_cols[:15]:  # Bound to top 15 numeric features to avoid prompt bloat
        series = df[col].dropna()
        if len(series) > 0:
            try:
                mean_val = float(series.mean())
                std_val = float(series.std()) if len(series) > 1 else 0.0
                min_val = float(series.min())
                median_val = float(series.median())
                max_val = float(series.max())
                skew_val = float(series.skew()) if len(series) > 2 else 0.0

                numeric_summary[sanitize_string(col)] = {
                    "mean": round(mean_val, 3) if not math.isnan(mean_val) else 0.0,
                    "std": round(std_val, 3) if not math.isnan(std_val) else 0.0,
                    "min": round(min_val, 3) if not math.isnan(min_val) else 0.0,
                    "median": round(median_val, 3) if not math.isnan(median_val) else 0.0,
                    "max": round(max_val, 3) if not math.isnan(max_val) else 0.0,
                    "skewness": round(skew_val, 3) if not math.isnan(skew_val) else 0.0
                }
            except Exception:
                pass
    context["numeric_summary"] = numeric_summary

    # Categorical summaries (top 3 frequencies)
    categorical_summary = {}
    for col in cat_cols[:10]:
        series = df[col].dropna()
        if len(series) > 0:
            top_counts = series.value_counts().head(3).to_dict()
            clean_counts = {sanitize_string(k, 30): int(v) for k, v in top_counts.items()}
            categorical_summary[sanitize_string(col)] = {
                "top_categories": clean_counts,
                "cardinality": int(series.nunique())
            }
    context["categorical_summary"] = categorical_summary

    # Correlation Matrix & Target Leakage Detection (bounded to first 12 numeric cols)
    correlations = []
    leakage_warnings = []
    if len(num_cols) >= 2:
        try:
            sample_for_corr = df[num_cols[:12]].dropna()
            if len(sample_for_corr) >= 3:
                corr_matrix = sample_for_corr.corr()
                pairs = []
                cols = corr_matrix.columns
                target_col = metadata.get("suggested_target", "") if metadata else ""

                for i in range(len(cols)):
                    for j in range(i + 1, len(cols)):
                        val = corr_matrix.iloc[i, j]
                        if not math.isnan(val):
                            c1, c2 = sanitize_string(cols[i]), sanitize_string(cols[j])
                            r = round(float(val), 3)
                            pairs.append((c1, c2, r, abs(r)))
                            if target_col and (c1 == target_col or c2 == target_col) and abs(r) >= 0.95:
                                other_col = c2 if c1 == target_col else c1
                                leakage_warnings.append({
                                    "feature": other_col,
                                    "target": target_col,
                                    "correlation": r,
                                    "warning": f"Extreme correlation (|r| = {abs(r)}) with target indicates potential data leakage."
                                })

                pairs.sort(key=lambda x: x[3], reverse=True)
                for c1, c2, r, _ in pairs[:5]:
                    correlations.append({"feature_a": c1, "feature_b": c2, "pearson_r": r})
        except Exception:
            pass

    context["correlations"] = correlations
    context["target_leakage_warnings"] = leakage_warnings

    # Quality overview integration
    if quality_analysis:
        overview = quality_analysis.get("overview", {})
        missing = quality_analysis.get("missing_values", {})
        outliers = quality_analysis.get("outliers", {})

        context["quality_overview"] = {
            "completeness_score": overview.get("completeness_score", 100.0),
            "duplicate_rows": overview.get("duplicate_rows", 0),
            "total_missing_cells": missing.get("total_missing", 0),
            "columns_with_outliers": len([c for c, o in outliers.items() if o.get("outlier_pct", 0) > 0])
        }
    else:
        # Fallback direct quality calculations from df
        total_cells = df.shape[0] * df.shape[1]
        missing_cells = int(df.isna().sum().sum())
        comp = round(((total_cells - missing_cells) / max(1, total_cells)) * 100, 1)
        dups = int(df.duplicated().sum())
        context["quality_overview"] = {
            "completeness_score": comp,
            "duplicate_rows": dups,
            "total_missing_cells": missing_cells,
            "columns_with_outliers": 0
        }

    # ML results summary integration
    if ml_results and ml_results.get("comparison_table"):
        table = ml_results["comparison_table"]
        ml_meta = ml_results.get("ml_meta", {})
        top_model = table[0] if table else {}

        context["ml_summary"] = {
            "evaluated_models_count": len(table),
            "problem_type": ml_meta.get("problem_type", "classification"),
            "target_column": ml_meta.get("target_column", ""),
            "best_model_name": top_model.get("Model", ""),
            "best_model_metrics": {
                k: v for k, v in top_model.items()
                if k not in ["Model", "status", "cv_scores"]
            }
        }

    # Sample rows (ONLY if user opted in with explicit consent)
    if share_sample_rows:
        sample_df = df.head(max_sample_rows).copy()
        clean_samples = []
        for _, row in sample_df.iterrows():
            clean_samples.append({
                sanitize_string(k, 30): sanitize_string(v, 60) for k, v in row.to_dict().items()
            })
        context["sample_rows"] = clean_samples
        context["privacy_notice"] = f"User consented to include {len(clean_samples)} sanitized sample rows."

    return context


def format_context_prompt(context: Dict[str, Any]) -> str:
    """
    Format dataset context into a structured prompt block with explicit injection boundaries.
    """
    if not context.get("has_dataset"):
        return "<untrusted_dataset_context>\nNo active dataset loaded in workspace.\n</untrusted_dataset_context>"

    lines = [
        "<untrusted_dataset_context>",
        f"DATASET NAME: {context.get('name')}",
        f"DIMENSIONS: {context.get('rows'):,} rows x {context.get('cols')} columns",
        f"TASK INTENT: {context.get('task', 'general')} | TARGET: {context.get('suggested_target', 'none')}",
        f"DATA HEALTH: Completeness: {context.get('quality_overview', {}).get('completeness_score', 100)}% | Duplicates: {context.get('quality_overview', {}).get('duplicate_rows', 0)}",
        "",
        "COLUMNS & TYPES:"
    ]

    for col in context.get("columns", [])[:20]:
        missing_str = f"({col['missing_pct']}% null)" if col['missing_pct'] > 0 else "(complete)"
        lines.append(f"- {col['name']} [{col['type']}]: {col['unique_values']} unique values {missing_str}")

    if context.get("numeric_summary"):
        lines.append("\nNUMERIC DISTRIBUTIONS:")
        for col, s in list(context["numeric_summary"].items())[:8]:
            lines.append(f"- {col}: mean={s['mean']}, std={s['std']}, range=[{s['min']}, {s['max']}], median={s['median']}, skew={s['skewness']}")

    if context.get("categorical_summary"):
        lines.append("\nCATEGORICAL FREQUENCIES (TOP 3):")
        for col, s in list(context["categorical_summary"].items())[:5]:
            top_str = ", ".join([f"'{k}': {v}" for k, v in s['top_categories'].items()])
            lines.append(f"- {col}: {top_str}")

    if context.get("correlations"):
        lines.append("\nTOP PEARSON CORRELATIONS:")
        for corr in context["correlations"][:5]:
            lines.append(f"- {corr['feature_a']} <-> {corr['feature_b']}: r = {corr['pearson_r']}")

    if context.get("target_leakage_warnings"):
        lines.append("\n⚠️ TARGET LEAKAGE WARNINGS:")
        for leak in context["target_leakage_warnings"]:
            lines.append(f"- {leak['feature']} has extreme correlation ({leak['correlation']}) with target {leak['target']}")

    if context.get("ml_summary"):
        ml = context["ml_summary"]
        lines.append("\nTRAINED ML BENCHMARK:")
        lines.append(f"- Models Trained: {ml.get('evaluated_models_count')} algorithms | Problem: {ml.get('problem_type')}")
        lines.append(f"- Leader: {ml.get('best_model_name')} with metrics: {ml.get('best_model_metrics')}")

    if context.get("sample_rows"):
        lines.append("\nUSER-CONSENTED SAMPLE ROWS (MAX 3):")
        for idx, row in enumerate(context["sample_rows"], 1):
            row_str = ", ".join([f"{k}={v}" for k, v in list(row.items())[:8]])
            lines.append(f"Row {idx}: {row_str}")

    lines.append(f"\nPRIVACY CONTEXT: {context.get('privacy_notice')}")
    lines.append("</untrusted_dataset_context>")

    return "\n".join(lines)
