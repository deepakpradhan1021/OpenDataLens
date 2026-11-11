"""
Data Quality Analysis Engine for OpenDataLens
Performs comprehensive quality assessment:
- Missing value profiling & completeness scoring
- Exact and partial duplicate detection
- Smart data type inference (numeric, categorical, datetime, text, constants, ID keys)
- Descriptive statistical summaries (moments, distributions, cardinality)
- Outlier detection via Interquartile Range (IQR) method
- High-cardinality categorical warnings
- Multicollinearity and Target Leakage analysis (|r| > 0.95)
- Actionable, rule-based data quality recommendations
"""

from typing import Dict, Any, List, Optional, Tuple
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
                classification["categorical"].append(col)
            else:
                classification["numeric"].append(col)
        else:
            if n_unique > 0:
                avg_len = non_null_series.astype(str).str.len().mean()
                if avg_len > 40 and (n_unique / max(len(non_null_series), 1)) > 0.6:
                    classification["text"].append(col)
                else:
                    classification["categorical"].append(col)
            else:
                classification["categorical"].append(col)

    return classification


def detect_outliers_iqr(df: pd.DataFrame, numeric_cols: List[str]) -> Dict[str, Dict[str, Any]]:
    """
    Detect numerical outliers using the robust Interquartile Range (IQR) technique.
    Outlier: x < Q1 - 1.5*IQR or x > Q3 + 1.5*IQR.
    """
    outlier_summary = {}
    n_rows = len(df)

    for col in numeric_cols:
        series = df[col].dropna()
        if len(series) < 8:
            continue

        q25 = float(series.quantile(0.25))
        q75 = float(series.quantile(0.75))
        iqr = q75 - q25

        if iqr == 0:
            std_val = float(series.std()) if len(series) > 1 else 0.0
            if std_val > 0:
                mean_val = float(series.mean())
                lower_bound = round(mean_val - 3 * std_val, 4)
                upper_bound = round(mean_val + 3 * std_val, 4)
            else:
                continue
        else:
            lower_bound = round(q25 - 1.5 * iqr, 4)
            upper_bound = round(q75 + 1.5 * iqr, 4)

        outlier_mask = (series < lower_bound) | (series > upper_bound)
        count = int(outlier_mask.sum())
        pct = round(float((count / max(len(series), 1)) * 100.0), 2)

        outlier_summary[col] = {
            "outlier_count": count,
            "outlier_pct": pct,
            "lower_bound": lower_bound,
            "upper_bound": upper_bound,
            "q25": round(q25, 4),
            "q75": round(q75, 4),
            "iqr": round(iqr, 4)
        }

    return outlier_summary


def detect_high_cardinality(df: pd.DataFrame, categorical_cols: List[str]) -> Dict[str, Dict[str, Any]]:
    """
    Identify categorical columns with high cardinality (>50 unique values or unique ratio > 0.4)
    that risk dimensional explosion in One-Hot Encoding.
    """
    high_card_summary = {}
    n_rows = len(df)

    for col in categorical_cols:
        series = df[col].dropna()
        n_unique = int(series.nunique())
        ratio = round(float(n_unique / max(len(series), 1)), 4)

        if n_unique > 50 or (n_unique > 20 and ratio > 0.4 and n_rows > 50):
            high_card_summary[col] = {
                "unique_count": n_unique,
                "uniqueness_ratio": ratio,
                "risk": "high" if n_unique > 50 else "moderate"
            }

    return high_card_summary


def compute_correlations_and_leakage(
    df: pd.DataFrame,
    numeric_cols: List[str]
) -> Tuple[Optional[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Calculate Pearson correlation matrix and identify extreme pairwise correlations (|r| >= 0.90)
    and potential target leakage risks (|r| >= 0.95).
    """
    if len(numeric_cols) < 2:
        return None, []

    num_df = df[numeric_cols].dropna()
    if len(num_df) < 5:
        return None, []

    corr_matrix = num_df.corr(method="pearson").round(3)
    corr_dict = corr_matrix.to_dict()

    high_corr_pairs = []
    seen = set()

    cols = list(corr_matrix.columns)
    for i in range(len(cols)):
        for j in range(i + 1, len(cols)):
            c1, c2 = cols[i], cols[j]
            r_val = float(corr_matrix.loc[c1, c2])
            if not np.isnan(r_val) and abs(r_val) >= 0.90:
                is_leakage = abs(r_val) >= 0.95
                high_corr_pairs.append({
                    "feature_1": c1,
                    "feature_2": c2,
                    "correlation": round(r_val, 3),
                    "is_leakage_risk": is_leakage,
                    "severity": "danger" if is_leakage else "warning"
                })

    high_corr_pairs.sort(key=lambda x: abs(x["correlation"]), reverse=True)
    return corr_dict, high_corr_pairs


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

    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
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

    # 5. Outlier Detection
    outliers = detect_outliers_iqr(df, numeric_cols)

    # 6. High Cardinality Detection
    high_cardinality = detect_high_cardinality(df, column_types.get("categorical", []))

    # 7. Correlation & Leakage Analysis
    corr_matrix, high_corr_pairs = compute_correlations_and_leakage(df, numeric_cols)

    # Memory Usage
    memory_bytes = int(df.memory_usage(deep=True).sum())

    analysis = {
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
        },
        "outliers": outliers,
        "high_cardinality": high_cardinality,
        "correlation_matrix": corr_matrix,
        "high_correlation_pairs": high_corr_pairs
    }

    # Generate recommendations based on real calculations
    analysis["recommendations"] = generate_quality_recommendations(analysis)
    return analysis


def generate_quality_recommendations(analysis: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Generate actionable data quality recommendations and warnings from audit results.
    """
    recommendations = []
    overview = analysis["overview"]
    missing = analysis["missing_values"]
    col_types = analysis["column_types"]
    col_missing = missing["column_summary"]
    outliers = analysis.get("outliers", {})
    high_card = analysis.get("high_cardinality", {})
    high_corr = analysis.get("high_correlation_pairs", [])

    # 1. Target Leakage / Extreme Multicollinearity Risk
    leakage_pairs = [p for p in high_corr if p.get("is_leakage_risk")]
    if leakage_pairs:
        leakage_descs = [f"{p['feature_1']} & {p['feature_2']} (|r|={p['correlation']})" for p in leakage_pairs[:3]]
        recommendations.append({
            "type": "danger",
            "title": f"Potential Target Leakage or Redundant Duplication ({len(leakage_pairs)} pair(s))",
            "description": f"Near-perfect linear correlation (|r| >= 0.95) detected between: {'; '.join(leakage_descs)}. One feature may be a duplicate or direct proxy of another.",
            "action": "Inspect these pairs closely and consider dropping one to eliminate multicollinearity or prevent target leakage.",
            "columns": list(set([p['feature_1'] for p in leakage_pairs] + [p['feature_2'] for p in leakage_pairs]))
        })

    # 2. Duplicate Records Warning
    if overview["duplicate_rows"] > 0:
        recommendations.append({
            "type": "warning",
            "title": f"Duplicate Records Detected ({overview['duplicate_rows']} rows, {overview['duplicate_pct']}%)",
            "description": "Duplicate samples can cause optimistic evaluation bias and model overfitting.",
            "action": "Consider deduplicating records with `df.drop_duplicates()` before model training.",
            "columns": []
        })

    # 3. High Missingness Columns (>40%)
    critical_missing = [c for c, m in col_missing.items() if m["missing_pct"] >= 40.0]
    if critical_missing:
        recommendations.append({
            "type": "danger",
            "title": f"High Missing Values in {len(critical_missing)} Column(s) (>40%)",
            "description": f"Columns with excessive missing data: {', '.join(critical_missing)}. Simple imputation may introduce significant synthetic distortion.",
            "action": "Drop these columns or introduce explicit missingness indicator flags.",
            "columns": critical_missing
        })

    # 4. Moderate Missing Values (0% - 40%)
    moderate_missing = [c for c, m in col_missing.items() if 0 < m["missing_pct"] < 40.0]
    if moderate_missing:
        recommendations.append({
            "type": "info",
            "title": f"Manageable Missing Values in {len(moderate_missing)} Column(s)",
            "description": f"Columns: {', '.join(moderate_missing)}. Contains between 1% and 40% missing entries.",
            "action": "OpenDataLens will apply robust median imputation for numerics and mode/constant imputation for categoricals.",
            "columns": moderate_missing
        })

    # 5. Outlier Detection Alert
    high_outlier_cols = [c for c, o in outliers.items() if o["outlier_pct"] >= 3.0]
    if high_outlier_cols:
        recommendations.append({
            "type": "warning",
            "title": f"Significant Outliers in {len(high_outlier_cols)} Numerical Feature(s)",
            "description": f"Columns exceeding 3% IQR boundaries: {', '.join(high_outlier_cols)}. High-leverage outliers can distort linear models and mean-squared errors.",
            "action": "Select RobustScaler in ML Studio or apply logarithmic/quantile transformations.",
            "columns": high_outlier_cols
        })

    # 6. High Cardinality Categoricals
    if high_card:
        high_card_cols = list(high_card.keys())
        recommendations.append({
            "type": "warning",
            "title": f"High-Cardinality Categorical Features ({len(high_card_cols)})",
            "description": f"Columns: {', '.join(high_card_cols)}. High category counts can exponentially inflate feature matrix width under One-Hot Encoding.",
            "action": "Group rare categories into an 'Other' bucket, or use frequency/target encoding.",
            "columns": high_card_cols
        })

    # 7. Zero-Variance / Constant Columns
    constants = col_types.get("constant", [])
    if constants:
        recommendations.append({
            "type": "warning",
            "title": f"Zero-Variance / Constant Columns Detected ({len(constants)})",
            "description": f"Columns with single value: {', '.join(constants)}. These provide zero information gain to predictive models.",
            "action": "Exclude these columns from feature sets prior to model training.",
            "columns": constants
        })

    # 8. Potential Identifier Columns
    id_candidates = col_types.get("id_candidate", [])
    if id_candidates:
        recommendations.append({
            "type": "info",
            "title": f"Possible ID / Primary Key Columns ({len(id_candidates)})",
            "description": f"Columns: {', '.join(id_candidates)}. Unique identifiers may cause target leakage or false memorization.",
            "action": "Avoid selecting ID columns as predictive features.",
            "columns": id_candidates
        })

    # 9. Overall Completeness Praise
    if overview["completeness_score"] >= 99.0 and overview["duplicate_rows"] == 0 and not leakage_pairs:
        recommendations.append({
            "type": "success",
            "title": "High Data Quality Health Score",
            "description": f"Dataset completeness is {overview['completeness_score']}% with zero duplicate rows and no severe leakage risks.",
            "action": "The dataset is ready for machine learning feature selection and baseline modeling.",
            "columns": []
        })

    return recommendations
