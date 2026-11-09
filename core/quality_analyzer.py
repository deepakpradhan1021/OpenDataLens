"""
Data Quality Analysis Engine for OpenDataLens
Performs comprehensive quality assessment:
- Missing value profiling & completeness scoring
- Exact and partial duplicate detection
- Smart data type inference (numeric, categorical, datetime, text, constants, ID keys)
- Descriptive statistical summaries (moments, distributions, cardinality)
- Actionable, rule-based data quality recommendations
"""

from typing import Dict, Any, List, Optional
import pandas as pd
import numpy as np


def detect_column_types(df: pd.DataFrame) -> Dict[str, List[str]]:
    """
    Intelligently classify DataFrame columns into semantic data categories:
    - numeric: continuous or multi-value numeric columns
    - categorical: string, categorical, boolean, or discrete low-cardinality integers
    - text: high-cardinality natural language text
    - datetime: datetime formatted columns
    - constant: single-value zero-variance columns
    - id_candidate: likely unique record identifiers
    """
    classification = {
        "numeric": [],
        "categorical": [],
        "text": [],
        "datetime": [],
        "constant": [],
        "id_candidate": []
    }

    n_rows = len(df)
    for col in df.columns:
        series = df[col]
        non_null_series = series.dropna()
        n_unique = non_null_series.nunique()

        # 1. Constant Column Check
        if n_unique <= 1:
            classification["constant"].append(col)
            continue

        # 2. Identifier Column Check
        is_id_name = any(kw in col.lower() for kw in ["id", "uuid", "guid", "key", "index", "code"])
        if n_unique == n_rows and is_id_name:
            classification["id_candidate"].append(col)

        # 3. Datetime Check
        if pd.api.types.is_datetime64_any_dtype(series):
            classification["datetime"].append(col)
            continue
        elif pd.api.types.is_object_dtype(series) or pd.api.types.is_string_dtype(series):
            # Probe sample for date parsing
            sample = non_null_series.head(20).astype(str)
            try:
                parsed = pd.to_datetime(sample, errors="coerce", format="mixed")
                if parsed.notna().sum() / max(len(sample), 1) > 0.8:
                    classification["datetime"].append(col)
                    continue
            except Exception:
                pass

        # 4. Numeric vs Categorical
        if pd.api.types.is_numeric_dtype(series):
            if pd.api.types.is_bool_dtype(series) or n_unique == 2:
                classification["categorical"].append(col)
            elif pd.api.types.is_integer_dtype(series) and n_unique <= 10 and n_rows > 50:
                # Low cardinality discrete integers (e.g. rating, class, status)
                classification["categorical"].append(col)
            else:
                classification["numeric"].append(col)
        else:
            # String or Object dtype
            # Check for free-form text vs categorical
            if n_unique > 0:
                avg_len = non_null_series.astype(str).str.len().mean()
                if avg_len > 40 and (n_unique / max(len(non_null_series), 1)) > 0.6:
                    classification["text"].append(col)
                else:
                    classification["categorical"].append(col)
            else:
                classification["categorical"].append(col)

    return classification


def analyze_data_quality(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Run an end-to-end data quality audit on a pandas DataFrame.
    Returns complete structured summary for dashboards, reports, and UI rendering.
    """
    if df.empty:
        raise ValueError("Cannot perform quality analysis on an empty DataFrame.")

    n_rows, n_cols = df.shape
    total_cells = n_rows * n_cols

    # 1. Missing Values Profiling
    missing_counts = df.isna().sum()
    missing_pcts = (missing_counts / n_rows) * 100.0
    total_missing_cells = int(missing_counts.sum())
    completeness_score = round(float((1.0 - (total_missing_cells / max(total_cells, 1))) * 100.0), 2)

    col_missing_summary = {}
    cols_with_missing = []
    for col in df.columns:
        m_count = int(missing_counts[col])
        m_pct = round(float(missing_pcts[col]), 2)
        if m_count > 0:
            cols_with_missing.append(col)
        col_missing_summary[col] = {
            "missing_count": m_count,
            "missing_pct": m_pct,
            "dtype": str(df[col].dtype),
            "present_count": int(df[col].count())
        }

    # 2. Duplicate Records Analysis
    duplicate_rows = int(df.duplicated().sum())
    duplicate_pct = round(float((duplicate_rows / n_rows) * 100.0), 2)

    # 3. Column Type Classification
    column_types = detect_column_types(df)

    # 4. Statistical Summaries
    numeric_stats = {}
    categorical_stats = {}

    numeric_cols = df.select_dtypes(include=[np.number]).columns
    for col in numeric_cols:
        series = df[col].dropna()
        if len(series) > 0:
            try:
                skew_val = float(series.skew())
                skew_val = None if np.isnan(skew_val) else round(skew_val, 3)
            except Exception:
                skew_val = None

            try:
                kurt_val = float(series.kurt())
                kurt_val = None if np.isnan(kurt_val) else round(kurt_val, 3)
            except Exception:
                kurt_val = None

            numeric_stats[col] = {
                "count": int(series.count()),
                "mean": round(float(series.mean()), 4),
                "std": round(float(series.std()), 4) if len(series) > 1 else 0.0,
                "min": round(float(series.min()), 4),
                "q25": round(float(series.quantile(0.25)), 4),
                "median": round(float(series.median()), 4),
                "q75": round(float(series.quantile(0.75)), 4),
                "max": round(float(series.max()), 4),
                "skewness": skew_val,
                "kurtosis": kurt_val
            }

    non_numeric_cols = [c for c in df.columns if c not in numeric_cols]
    for col in non_numeric_cols:
        series = df[col].dropna()
        if len(series) > 0:
            val_counts = series.value_counts()
            top_val = str(val_counts.index[0]) if len(val_counts) > 0 else "N/A"
            top_freq = int(val_counts.iloc[0]) if len(val_counts) > 0 else 0
            top_pct = round(float((top_freq / len(series)) * 100.0), 2)

            categorical_stats[col] = {
                "count": int(series.count()),
                "unique": int(series.nunique()),
                "top": top_val,
                "top_freq": top_freq,
                "top_freq_pct": top_pct,
                "value_distribution": val_counts.head(10).to_dict()
            }

    # Memory Usage
    memory_bytes = int(df.memory_usage(deep=True).sum())

    return {
        "overview": {
            "total_rows": n_rows,
            "total_cols": n_cols,
            "total_cells": total_cells,
            "total_missing_cells": total_missing_cells,
            "completeness_score": completeness_score,
            "duplicate_rows": duplicate_rows,
            "duplicate_pct": duplicate_pct,
            "memory_bytes": memory_bytes,
            "memory_mb": round(memory_bytes / (1024 * 1024), 2)
        },
        "missing_values": {
            "total_missing_cells": total_missing_cells,
            "columns_with_missing": cols_with_missing,
            "columns_with_missing_count": len(cols_with_missing),
            "column_summary": col_missing_summary
        },
        "column_types": column_types,
        "statistics": {
            "numeric_stats": numeric_stats,
            "categorical_stats": categorical_stats
        }
    }


def generate_quality_recommendations(analysis: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Generate actionable data quality recommendations and warnings from audit results.
    """
    recommendations = []
    overview = analysis["overview"]
    missing = analysis["missing_values"]
    col_types = analysis["column_types"]
    col_missing = missing["column_summary"]

    # 1. Duplicate Records Warning
    if overview["duplicate_rows"] > 0:
        recommendations.append({
            "type": "warning",
            "title": f"Duplicate Records Detected ({overview['duplicate_rows']} rows, {overview['duplicate_pct']}%)",
            "description": "Duplicate samples can cause optimistic evaluation bias and model overfitting.",
            "action": "Consider deduplicating records with `df.drop_duplicates()` before model training.",
            "columns": []
        })

    # 2. High Missingness Columns (>40%)
    critical_missing = [c for c, m in col_missing.items() if m["missing_pct"] >= 40.0]
    if critical_missing:
        recommendations.append({
            "type": "danger",
            "title": f"High Missing Values in {len(critical_missing)} Column(s) (>40%)",
            "description": f"Columns with excessive missing data: {', '.join(critical_missing)}. Simple imputation may introduce significant synthetic distortion.",
            "action": "Drop these columns or introduce explicit missingness indicator flags.",
            "columns": critical_missing
        })

    # 3. Moderate Missing Values (0% - 40%)
    moderate_missing = [c for c, m in col_missing.items() if 0 < m["missing_pct"] < 40.0]
    if moderate_missing:
        recommendations.append({
            "type": "info",
            "title": f"Manageable Missing Values in {len(moderate_missing)} Column(s)",
            "description": f"Columns: {', '.join(moderate_missing)}. Contains between 1% and 40% missing entries.",
            "action": "OpenDataLens will apply robust median imputation for numerics and mode/constant imputation for categoricals.",
            "columns": moderate_missing
        })

    # 4. Zero-Variance / Constant Columns
    constants = col_types.get("constant", [])
    if constants:
        recommendations.append({
            "type": "warning",
            "title": f"Zero-Variance / Constant Columns Detected ({len(constants)})",
            "description": f"Columns with single value: {', '.join(constants)}. These provide zero information gain to predictive models.",
            "action": "Exclude these columns from feature sets prior to model training.",
            "columns": constants
        })

    # 5. Potential Identifier / High-Cardinality Columns
    id_candidates = col_types.get("id_candidate", [])
    if id_candidates:
        recommendations.append({
            "type": "info",
            "title": f"Possible ID / Primary Key Columns ({len(id_candidates)})",
            "description": f"Columns: {', '.join(id_candidates)}. Unique identifiers may cause target leakage or false memorization.",
            "action": "Avoid selecting ID columns as predictive features.",
            "columns": id_candidates
        })

    # 6. Overall Completeness Praise
    if overview["completeness_score"] >= 99.0 and overview["duplicate_rows"] == 0:
        recommendations.append({
            "type": "success",
            "title": "High Data Quality Health Score",
            "description": f"Dataset completeness is {overview['completeness_score']}% with zero duplicate rows.",
            "action": "The dataset is ready for machine learning feature selection and baseline modeling.",
            "columns": []
        })

    return recommendations
