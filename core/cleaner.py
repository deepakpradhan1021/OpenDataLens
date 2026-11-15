"""
Data Cleaning and Transformation Engine for OpenDataLens.
Provides deterministic, leak-free tabular data cleansing, imputation,
outlier clipping, type casting, duplicate removal, and row filtering.
"""

from typing import List, Optional, Any, Tuple, Dict
import pandas as pd
import numpy as np


def impute_missing(
    df: pd.DataFrame,
    column: str,
    strategy: str = "median",
    constant_value: Optional[Any] = None
) -> Tuple[pd.DataFrame, str]:
    """Impute missing values in a column using median, mean, mode, constant, or row drop."""
    if column not in df.columns:
        raise ValueError(f"Column '{column}' does not exist in dataset.")

    df_clean = df.copy()
    s = df_clean[column]
    null_count_before = int(s.isna().sum())

    if null_count_before == 0:
        return df_clean, f"Column '{column}' had 0 null values; no imputation performed."

    strat = strategy.lower().strip()
    if strat == "drop":
        df_clean = df_clean.dropna(subset=[column]).reset_index(drop=True)
        return df_clean, f"Dropped {null_count_before} rows with missing values in '{column}'."

    elif strat in ["median", "mean"]:
        if not pd.api.types.is_numeric_dtype(s):
            raise ValueError(f"Strategy '{strat}' requires numeric column. Column '{column}' has dtype '{s.dtype}'.")
        fill_val = s.median() if strat == "median" else s.mean()
        df_clean[column] = s.fillna(fill_val)
        return df_clean, f"Imputed {null_count_before} missing values in '{column}' with {strat} ({round(float(fill_val), 4)})."

    elif strat == "mode":
        mode_series = s.mode()
        fill_val = mode_series.iloc[0] if not mode_series.empty else "Unknown"
        df_clean[column] = s.fillna(fill_val)
        return df_clean, f"Imputed {null_count_before} missing values in '{column}' with mode ('{fill_val}')."

    elif strat == "constant":
        val = constant_value if constant_value is not None else 0
        df_clean[column] = s.fillna(val)
        return df_clean, f"Imputed {null_count_before} missing values in '{column}' with constant ('{val}')."

    else:
        raise ValueError(f"Unknown imputation strategy: '{strategy}'. Choose from: median, mean, mode, constant, drop.")


def remove_duplicates(
    df: pd.DataFrame,
    subset: Optional[List[str]] = None,
    keep: str = "first"
) -> Tuple[pd.DataFrame, str]:
    """Remove duplicate rows from dataset, optionally based on a subset of columns."""
    df_clean = df.copy()
    cols = [c for c in subset if c in df_clean.columns] if subset else None
    dup_mask = df_clean.duplicated(subset=cols, keep=keep)
    dup_count = int(dup_mask.sum())

    if dup_count == 0:
        return df_clean, "No duplicate rows found."

    df_clean = df_clean[~dup_mask].reset_index(drop=True)
    scope = f"on columns [{', '.join(cols)}]" if cols else "across all columns"
    return df_clean, f"Removed {dup_count} duplicate rows ({scope})."


def convert_column_dtype(
    df: pd.DataFrame,
    column: str,
    target_dtype: str
) -> Tuple[pd.DataFrame, str]:
    """Convert column data type safely."""
    if column not in df.columns:
        raise ValueError(f"Column '{column}' does not exist in dataset.")

    df_clean = df.copy()
    target = target_dtype.lower().strip()

    if target in ["numeric", "float", "number"]:
        df_clean[column] = pd.to_numeric(df_clean[column], errors="coerce")
        action = f"Converted column '{column}' to numeric float."
    elif target in ["int", "integer"]:
        df_clean[column] = pd.to_numeric(df_clean[column], errors="coerce").round().astype("Int64")
        action = f"Converted column '{column}' to nullable integer."
    elif target in ["string", "text", "str"]:
        df_clean[column] = df_clean[column].astype(str)
        action = f"Converted column '{column}' to string text."
    elif target in ["category", "categorical"]:
        df_clean[column] = df_clean[column].astype("category")
        action = f"Converted column '{column}' to categorical."
    elif target in ["datetime", "date"]:
        df_clean[column] = pd.to_datetime(df_clean[column], errors="coerce")
        action = f"Converted column '{column}' to datetime."
    elif target in ["bool", "boolean"]:
        df_clean[column] = df_clean[column].astype(bool)
        action = f"Converted column '{column}' to boolean."
    else:
        raise ValueError(f"Unsupported target dtype: '{target_dtype}'. Choose from: numeric, integer, string, categorical, datetime, boolean.")

    return df_clean, action


def rename_column(
    df: pd.DataFrame,
    old_name: str,
    new_name: str
) -> Tuple[pd.DataFrame, str]:
    """Rename a column with whitespace strip and collision prevention."""
    if old_name not in df.columns:
        raise ValueError(f"Column '{old_name}' not found.")
    clean_new = new_name.strip()
    if not clean_new:
        raise ValueError("New column name cannot be empty.")
    if clean_new in df.columns and clean_new != old_name:
        raise ValueError(f"Column '{clean_new}' already exists in dataset.")

    df_clean = df.rename(columns={old_name: clean_new})
    return df_clean, f"Renamed column '{old_name}' to '{clean_new}'."


def drop_columns(
    df: pd.DataFrame,
    columns: List[str]
) -> Tuple[pd.DataFrame, str]:
    """Drop specified columns from the dataset."""
    valid_cols = [c for c in columns if c in df.columns]
    if not valid_cols:
        raise ValueError(f"None of the specified columns exist in dataset: {columns}")
    if len(valid_cols) >= len(df.columns):
        raise ValueError("Cannot drop all columns in dataset.")

    df_clean = df.drop(columns=valid_cols)
    return df_clean, f"Dropped {len(valid_cols)} column(s): {', '.join(valid_cols)}."


def clip_outliers(
    df: pd.DataFrame,
    column: str,
    lower_quantile: float = 0.01,
    upper_quantile: float = 0.99
) -> Tuple[pd.DataFrame, str]:
    """Winsorize/clip extreme outliers in a numeric column to specified quantiles."""
    if column not in df.columns:
        raise ValueError(f"Column '{column}' does not exist in dataset.")
    if not pd.api.types.is_numeric_dtype(df[column]):
        raise ValueError(f"Column '{column}' is not numeric; cannot clip outliers.")
    if not (0.0 <= lower_quantile < upper_quantile <= 1.0):
        raise ValueError("Quantiles must satisfy: 0.0 <= lower_quantile < upper_quantile <= 1.0.")

    df_clean = df.copy()
    s = df_clean[column].dropna()
    if s.empty:
        return df_clean, f"Column '{column}' has no non-null values; outlier clipping skipped."

    lower_val = float(s.quantile(lower_quantile))
    upper_val = float(s.quantile(upper_quantile))
    clipped_mask = (df_clean[column] < lower_val) | (df_clean[column] > upper_val)
    clipped_count = int(clipped_mask.sum())

    df_clean[column] = df_clean[column].clip(lower=lower_val, upper=upper_val)
    return df_clean, f"Clipped {clipped_count} outliers in '{column}' between [{round(lower_val, 4)}, {round(upper_val, 4)}]."


def filter_rows(
    df: pd.DataFrame,
    column: str,
    operator: str,
    value: Any
) -> Tuple[pd.DataFrame, str]:
    """Filter rows based on column condition."""
    if column not in df.columns:
        raise ValueError(f"Column '{column}' does not exist in dataset.")

    df_clean = df.copy()
    op = operator.strip()
    s = df_clean[column]
    rows_before = len(df_clean)

    if op == "==":
        mask = s == value
    elif op == "!=":
        mask = s != value
    elif op == ">":
        mask = s > float(value)
    elif op == ">=":
        mask = s >= float(value)
    elif op == "<":
        mask = s < float(value)
    elif op == "<=":
        mask = s <= float(value)
    elif op == "contains":
        mask = s.astype(str).str.contains(str(value), case=False, na=False)
    else:
        raise ValueError(f"Unsupported operator '{operator}'. Choose from: ==, !=, >, >=, <, <=, contains.")

    df_filtered = df_clean[mask].reset_index(drop=True)
    if df_filtered.empty:
        raise ValueError(f"Filtering resulted in 0 rows. Condition '{column} {operator} {value}' would remove all data.")

    removed = rows_before - len(df_filtered)
    return df_filtered, f"Filtered rows with condition '{column} {op} {value}'; kept {len(df_filtered)} rows (removed {removed})."


def sort_rows(
    df: pd.DataFrame,
    column: str,
    ascending: bool = True
) -> Tuple[pd.DataFrame, str]:
    """Sort dataset rows deterministically by a specified column."""
    if column not in df.columns:
        raise ValueError(f"Column '{column}' does not exist in dataset.")

    df_sorted = df.sort_values(by=column, ascending=ascending, na_position="last").reset_index(drop=True)
    direction = "ascending" if ascending else "descending"
    return df_sorted, f"Sorted dataset by column '{column}' in {direction} order."


def normalize_column(
    df: pd.DataFrame,
    column: str,
    method: str = "minmax"
) -> Tuple[pd.DataFrame, str]:
    """
    Normalize numeric feature values.
    Supported methods:
      - 'minmax': Scales values to range [0, 1]
      - 'zscore': Standardizes to mean=0, std=1
      - 'robust': Scales using median and Interquartile Range (IQR)
    """
    if column not in df.columns:
        raise ValueError(f"Column '{column}' does not exist in dataset.")
    if not pd.api.types.is_numeric_dtype(df[column]):
        raise ValueError(f"Column '{column}' is not numeric; cannot normalize.")

    df_clean = df.copy()
    s = df_clean[column].astype(float)
    meth = method.lower().strip()

    if meth in ["minmax", "min_max"]:
        c_min = s.min()
        c_max = s.max()
        if pd.isna(c_min) or pd.isna(c_max) or c_max == c_min:
            df_clean[column] = 0.0
            return df_clean, f"Normalized '{column}' (constant column scaled to 0.0)."
        df_clean[column] = ((s - c_min) / (c_max - c_min)).round(5)
        return df_clean, f"Normalized '{column}' using Min-Max scaling [0, 1] (min={round(c_min, 3)}, max={round(c_max, 3)})."

    elif meth in ["zscore", "standard", "standardize"]:
        mean = s.mean()
        std = s.std(ddof=0)
        if pd.isna(std) or std == 0:
            df_clean[column] = 0.0
            return df_clean, f"Standardized '{column}' (zero variance column scaled to 0.0)."
        df_clean[column] = ((s - mean) / std).round(5)
        return df_clean, f"Standardized '{column}' using Z-score (mean={round(mean, 3)}, std={round(std, 3)})."

    elif meth in ["robust"]:
        median = s.median()
        q25 = s.quantile(0.25)
        q75 = s.quantile(0.75)
        iqr = q75 - q25
        if pd.isna(iqr) or iqr == 0:
            df_clean[column] = 0.0
            return df_clean, f"Robust-scaled '{column}' (zero IQR column scaled to 0.0)."
        df_clean[column] = ((s - median) / iqr).round(5)
        return df_clean, f"Robust-scaled '{column}' using Median-IQR (median={round(median, 3)}, IQR={round(iqr, 3)})."

    else:
        raise ValueError(f"Unsupported normalization method '{method}'. Choose from: minmax, zscore, robust.")


def remove_outliers(
    df: pd.DataFrame,
    column: str,
    method: str = "iqr",
    threshold: float = 1.5
) -> Tuple[pd.DataFrame, str]:
    """
    Detect and drop rows containing outliers in a numeric column.
    Supported methods:
      - 'iqr': Filters rows outside [Q1 - k*IQR, Q3 + k*IQR] (default k=1.5)
      - 'zscore': Filters rows outside [mean - k*std, mean + k*std] (default k=3.0)
    """
    if column not in df.columns:
        raise ValueError(f"Column '{column}' does not exist in dataset.")
    if not pd.api.types.is_numeric_dtype(df[column]):
        raise ValueError(f"Column '{column}' is not numeric; cannot filter outliers.")

    df_clean = df.copy()
    s = df_clean[column].dropna()
    if s.empty:
        return df_clean, f"Column '{column}' has no non-null values; outlier removal skipped."

    rows_before = len(df_clean)
    meth = method.lower().strip()

    if meth == "iqr":
        q25 = float(s.quantile(0.25))
        q75 = float(s.quantile(0.75))
        iqr = q75 - q25
        lower_bound = q25 - (threshold * iqr)
        upper_bound = q75 + (threshold * iqr)
    elif meth in ["zscore", "z_score", "std"]:
        mean = float(s.mean())
        std = float(s.std(ddof=0))
        lower_bound = mean - (threshold * std)
        upper_bound = mean + (threshold * std)
    else:
        raise ValueError(f"Unsupported outlier removal method: '{method}'. Choose from: iqr, zscore.")

    # Keep rows within bounds (nulls are preserved unless imputed/dropped separately)
    mask = (df_clean[column].isna()) | ((df_clean[column] >= lower_bound) & (df_clean[column] <= upper_bound))
    df_filtered = df_clean[mask].reset_index(drop=True)

    if df_filtered.empty:
        raise ValueError(f"Removing outliers from '{column}' would eliminate all {rows_before} rows.")

    removed_count = rows_before - len(df_filtered)
    return df_filtered, f"Removed {removed_count} outlier rows from '{column}' using {meth.upper()} (bounds: [{round(lower_bound, 3)}, {round(upper_bound, 3)}])."


def preview_cleaning_action(
    df: pd.DataFrame,
    action_type: str,
    params: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Execute a dry-run of a cleaning operation without modifying workspace state.
    Returns preview metrics, row counts, and before/after sample records.
    """
    rows_before = int(df.shape[0])
    cols_before = int(df.shape[1])
    target_col = params.get("column") or params.get("old_name")

    # Run action on a copy
    transformed_df, summary = apply_cleaning_action(df, action_type, params)
    rows_after = int(transformed_df.shape[0])
    cols_after = int(transformed_df.shape[1])

    def sanitize_records(records_list: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        clean_list = []
        for r in records_list:
            clean_r = {}
            for k, v in r.items():
                if pd.isna(v) or v is np.nan:
                    clean_r[k] = None
                elif isinstance(v, (np.floating, float)) and (np.isinf(v) or np.isnan(v)):
                    clean_r[k] = None
                elif hasattr(v, "item"):
                    clean_r[k] = v.item()
                else:
                    clean_r[k] = v
            clean_list.append(clean_r)
        return clean_list

    sample_before = sanitize_records(df.head(5).to_dict(orient="records"))
    sample_after = sanitize_records(transformed_df.head(5).to_dict(orient="records"))

    # Compute stats if target column is numeric
    stats_before = None
    stats_after = None
    if target_col and target_col in df.columns and pd.api.types.is_numeric_dtype(df[target_col]):
        s_b = df[target_col].dropna()
        if not s_b.empty:
            stats_before = {
                "min": round(float(s_b.min()), 4),
                "max": round(float(s_b.max()), 4),
                "mean": round(float(s_b.mean()), 4),
                "null_count": int(df[target_col].isna().sum())
            }

    effective_col = params.get("new_name") or target_col
    if effective_col and effective_col in transformed_df.columns and pd.api.types.is_numeric_dtype(transformed_df[effective_col]):
        s_a = transformed_df[effective_col].dropna()
        if not s_a.empty:
            stats_after = {
                "min": round(float(s_a.min()), 4),
                "max": round(float(s_a.max()), 4),
                "mean": round(float(s_a.mean()), 4),
                "null_count": int(transformed_df[effective_col].isna().sum())
            }

    return {
        "status": "preview",
        "action_type": action_type,
        "summary": summary,
        "rows_before": rows_before,
        "rows_after": rows_after,
        "cols_before": cols_before,
        "cols_after": cols_after,
        "affected_column": target_col,
        "sample_before": sample_before,
        "sample_after": sample_after,
        "stats_before": stats_before,
        "stats_after": stats_after
    }


def apply_cleaning_action(df: pd.DataFrame, action_type: str, params: Dict[str, Any]) -> Tuple[pd.DataFrame, str]:
    """Unified dispatcher for data cleaning operations."""
    act = action_type.lower().strip()
    if act == "impute_missing":
        return impute_missing(
            df=df,
            column=params.get("column", ""),
            strategy=params.get("strategy", "median"),
            constant_value=params.get("constant_value")
        )
    elif act == "remove_duplicates":
        return remove_duplicates(
            df=df,
            subset=params.get("subset"),
            keep=params.get("keep", "first")
        )
    elif act == "convert_dtype":
        return convert_column_dtype(
            df=df,
            column=params.get("column", ""),
            target_dtype=params.get("target_dtype", "numeric")
        )
    elif act == "rename_column":
        return rename_column(
            df=df,
            old_name=params.get("old_name", ""),
            new_name=params.get("new_name", "")
        )
    elif act == "drop_columns":
        return drop_columns(
            df=df,
            columns=params.get("columns", [])
        )
    elif act == "clip_outliers":
        return clip_outliers(
            df=df,
            column=params.get("column", ""),
            lower_quantile=float(params.get("lower_quantile", 0.01)),
            upper_quantile=float(params.get("upper_quantile", 0.99))
        )
    elif act in ["remove_outliers", "drop_outliers"]:
        return remove_outliers(
            df=df,
            column=params.get("column", ""),
            method=params.get("method", "iqr"),
            threshold=float(params.get("threshold", 1.5))
        )
    elif act in ["normalize", "normalize_column"]:
        return normalize_column(
            df=df,
            column=params.get("column", ""),
            method=params.get("method", "minmax")
        )
    elif act in ["sort_rows", "sort"]:
        return sort_rows(
            df=df,
            column=params.get("column", ""),
            ascending=bool(params.get("ascending", True))
        )
    elif act == "filter_rows":
        return filter_rows(
            df=df,
            column=params.get("column", ""),
            operator=params.get("operator", "=="),
            value=params.get("value")
        )
    else:
        raise ValueError(f"Unknown cleaning action type: '{action_type}'.")
