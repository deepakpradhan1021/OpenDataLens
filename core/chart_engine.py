"""
Chart Engine & Visualization Analytics for OpenDataLens
Provides mathematically rigorous, full-dataset aggregations, interval binning,
true chronological trend detection, and correlation analysis powered by Pandas and NumPy.
"""

from typing import Dict, Any, List, Optional
import numpy as np
import pandas as pd


def detect_column_semantic_type(series: pd.Series) -> str:
    """Classify column as 'datetime', 'categorical', 'discrete_numeric', or 'continuous_numeric'."""
    if pd.api.types.is_datetime64_any_dtype(series):
        return "datetime"

    # Try detecting string date/time if object or string
    if series.dtype == object or pd.api.types.is_string_dtype(series) or "str" in str(series.dtype):
        # Check a sample of non-null values
        sample = series.dropna().head(20)
        if len(sample) > 0:
            try:
                parsed = pd.to_datetime(sample, errors="coerce")
                if parsed.notna().mean() >= 0.8:
                    return "datetime"
            except Exception:
                pass
        return "categorical"

    if pd.api.types.is_numeric_dtype(series):
        unique_cnt = series.nunique()
        if unique_cnt <= 15 and pd.api.types.is_integer_dtype(series):
            return "discrete_numeric"
        return "continuous_numeric"

    return "categorical"


def compute_chart_data(
    df: pd.DataFrame,
    chart_type: str,
    x_col: str,
    y_col: Optional[str] = None,
    aggregation: str = "mean",
    bins: int = 10,
    bin_numeric: bool = True,
    sort_by: str = "auto",
    top_n: int = 15,
    filter_min: Optional[float] = None,
    filter_max: Optional[float] = None,
    exclude_nulls: bool = True
) -> Dict[str, Any]:
    """
    Compute mathematically correct chart series and data intelligence from the active DataFrame.
    Guarantees that numbers match independently calculated Pandas aggregations.
    """
    if df is None or df.empty:
        return {
            "chart_type": chart_type,
            "data": [],
            "insights": {"error": "Dataset is empty or uninitialized."},
            "total_rows": 0
        }

    if x_col not in df.columns:
        return {
            "chart_type": chart_type,
            "data": [],
            "insights": {"error": f"Column '{x_col}' does not exist in dataset."},
            "total_rows": len(df)
        }

    # Clean working copy
    work_df = df.copy()

    if exclude_nulls:
        work_df = work_df.dropna(subset=[x_col])
        if y_col and y_col in work_df.columns:
            work_df = work_df.dropna(subset=[y_col])

    if filter_min is not None and y_col and y_col in work_df.columns:
        work_df = work_df[work_df[y_col] >= filter_min]

    if filter_max is not None and y_col and y_col in work_df.columns:
        work_df = work_df[work_df[y_col] <= filter_max]

    total_valid = len(work_df)
    if total_valid == 0:
        return {
            "chart_type": chart_type,
            "data": [],
            "insights": {"warning": "All records were filtered out by selected criteria."},
            "total_rows": len(df)
        }

    x_type = detect_column_semantic_type(work_df[x_col])
    is_x_numeric = x_type in ["continuous_numeric", "discrete_numeric"]
    is_y_numeric = bool(y_col and y_col in work_df.columns and pd.api.types.is_numeric_dtype(work_df[y_col]))

    # --- 1. HISTOGRAM ---
    if chart_type == "histogram":
        s = pd.to_numeric(work_df[x_col], errors="coerce").dropna()
        if len(s) == 0:
            return {"chart_type": chart_type, "data": [], "insights": {"warning": "No numeric data for histogram."}}

        counts, bin_edges = np.histogram(s, bins=max(5, min(30, bins)))
        hist_data = []
        for i in range(len(counts)):
            b_start = float(bin_edges[i])
            b_end = float(bin_edges[i + 1])
            hist_data.append({
                "name": f"[{b_start:.2f} - {b_end:.2f}]",
                "value": int(counts[i]),
                "count": int(counts[i]),
                "bin_start": b_start,
                "bin_end": b_end,
                "mid": (b_start + b_end) / 2.0
            })

        insights = {
            "distribution_type": "continuous_numeric",
            "mean": round(float(s.mean()), 3),
            "median": round(float(s.median()), 3),
            "std": round(float(s.std()), 3) if len(s) > 1 else 0.0,
            "min": round(float(s.min()), 3),
            "max": round(float(s.max()), 3),
            "observations": len(s),
            "summary_text": f"Distribution for {x_col}: Mean = {s.mean():.2f}, Median = {s.median():.2f}, Min = {s.min():.2f}, Max = {s.max():.2f} across {len(s):,} observations."
        }
        return {"chart_type": chart_type, "data": hist_data, "insights": insights, "total_rows": len(df)}

    # --- 2. SCATTER PLOT ---
    if chart_type == "scatter":
        if not y_col or y_col not in work_df.columns:
            return {"chart_type": chart_type, "data": [], "insights": {"error": "Scatter plot requires both X and Y columns."}}

        x_s = pd.to_numeric(work_df[x_col], errors="coerce")
        y_s = pd.to_numeric(work_df[y_col], errors="coerce")
        valid_mask = x_s.notna() & y_s.notna()
        sub = pd.DataFrame({"x": x_s[valid_mask], "y": y_s[valid_mask]}).reset_index(drop=True)

        if len(sub) == 0:
            return {"chart_type": chart_type, "data": [], "insights": {"warning": "No paired numeric points available."}}

        # Calculate exact correlation
        corr = float(sub["x"].corr(sub["y"])) if len(sub) > 1 else 0.0
        corr = 0.0 if np.isnan(corr) else round(corr, 3)

        # Decimate/sample for responsive frontend rendering if > 500 rows
        if len(sub) > 500:
            plot_sub = sub.sample(n=500, random_state=42).sort_values("x")
        else:
            plot_sub = sub.sort_values("x")

        points = []
        for idx, r in plot_sub.iterrows():
            points.append({
                "x": round(float(r["x"]), 3),
                "y": round(float(r["y"]), 3),
                "name": f"Obs #{idx + 1}"
            })

        rel_desc = (
            f"Strong positive correlation (r = {corr:+.2f})." if corr >= 0.6
            else f"Moderate positive correlation (r = {corr:+.2f})." if corr >= 0.25
            else f"Strong negative correlation (r = {corr:+.2f})." if corr <= -0.6
            else f"Moderate negative correlation (r = {corr:+.2f})." if corr <= -0.25
            else f"No meaningful linear correlation (r = {corr:+.2f})."
        )

        insights = {
            "correlation": corr,
            "observations_plotted": len(points),
            "total_observations": len(sub),
            "x_min": round(float(sub["x"].min()), 3),
            "x_max": round(float(sub["x"].max()), 3),
            "y_min": round(float(sub["y"].min()), 3),
            "y_max": round(float(sub["y"].max()), 3),
            "summary_text": f"{x_col} vs {y_col}: {rel_desc} Analyzed across {len(sub):,} actual pairs."
        }
        return {"chart_type": chart_type, "data": points, "insights": insights, "total_rows": len(df)}

    # --- 3. HEATMAP ---
    if chart_type == "heatmap":
        num_cols = work_df.select_dtypes(include=[np.number]).columns.tolist()
        if len(num_cols) < 2:
            return {"chart_type": chart_type, "data": [], "insights": {"warning": "Dataset requires at least 2 numerical columns for correlation matrix."}}

        # Up to top 10 columns for readable visual matrix
        cols_to_use = num_cols[:10]
        corr_matrix = work_df[cols_to_use].corr(method="pearson").round(3)
        corr_matrix = corr_matrix.fillna(0.0)

        matrix_dict: Dict[str, Dict[str, float]] = {}
        for c1 in cols_to_use:
            matrix_dict[c1] = {}
            for c2 in cols_to_use:
                matrix_dict[c1][c2] = float(corr_matrix.loc[c1, c2])

        # Identify strongest pair
        strongest_pair = None
        max_abs_corr = -1.0
        for i, c1 in enumerate(cols_to_use):
            for c2 in cols_to_use[i + 1:]:
                val = abs(matrix_dict[c1][c2])
                if val > max_abs_corr:
                    max_abs_corr = val
                    strongest_pair = (c1, c2, matrix_dict[c1][c2])

        summary_text = (
            f"Computed Pearson correlation matrix across {len(cols_to_use)} features. "
            + (f"Strongest relationship: {strongest_pair[0]} & {strongest_pair[1]} (r = {strongest_pair[2]:+.2f})." if strongest_pair else "")
        )

        insights = {
            "columns": cols_to_use,
            "strongest_pair": {
                "feature_a": strongest_pair[0] if strongest_pair else "",
                "feature_b": strongest_pair[1] if strongest_pair else "",
                "correlation": strongest_pair[2] if strongest_pair else 0.0
            } if strongest_pair else None,
            "summary_text": summary_text
        }
        return {"chart_type": chart_type, "data": {"columns": cols_to_use, "matrix": matrix_dict}, "insights": insights, "total_rows": len(df)}

    # --- 4. BAR, LINE, AREA, PIE, DONUT ---
    # Determine whether to bin continuous numeric X
    should_bin = (
        bin_numeric
        and is_x_numeric
        and work_df[x_col].nunique() > 20
    )

    agg_fn = aggregation if aggregation in ["mean", "sum", "count", "min", "max", "median", "std"] else "mean"

    data_items = []
    if should_bin:
        # Proper mathematical interval binning
        cuts = pd.cut(work_df[x_col].dropna(), bins=max(4, min(20, bins)))
        grp = work_df.groupby(cuts, observed=False)

        if is_y_numeric and y_col:
            res_series = grp[y_col].agg(agg_fn)
        else:
            res_series = grp.size()
        counts_series = grp.size()

        for interval, val in res_series.items():
            if pd.isna(interval):
                continue
            v = float(val) if pd.notna(val) else 0.0
            cnt = int(counts_series[interval])
            data_items.append({
                "name": f"[{interval.left:.2f} - {interval.right:.2f}]",
                "value": round(v, 2),
                "count": cnt,
                "mid": float(interval.mid)
            })

        # By default for binned numeric X, order naturally by X interval midpoint
        if sort_by == "y_desc":
            data_items.sort(key=lambda item: item["value"], reverse=True)
        else:
            data_items.sort(key=lambda item: item["mid"])

    elif x_type == "datetime":
        # Parse datetime
        date_s = pd.to_datetime(work_df[x_col], errors="coerce")
        temp_df = work_df[date_s.notna()].copy()
        temp_df["_dt_"] = date_s[date_s.notna()]
        temp_df = temp_df.sort_values("_dt_")

        # Format date labels based on span and unique observation count
        date_span = (temp_df["_dt_"].max() - temp_df["_dt_"].min()).days
        unique_dates = temp_df["_dt_"].nunique()
        if date_span > 730 and unique_dates > 30:
            temp_df["_period_"] = temp_df["_dt_"].dt.strftime("%Y")
        elif date_span > 90 and unique_dates > 30:
            temp_df["_period_"] = temp_df["_dt_"].dt.strftime("%Y-%m")
        else:
            temp_df["_period_"] = temp_df["_dt_"].dt.strftime("%Y-%m-%d")

        grp = temp_df.groupby("_period_", sort=False)
        if is_y_numeric and y_col:
            res_series = grp[y_col].agg(agg_fn)
        else:
            res_series = grp.size()
        counts_series = grp.size()

        for period_key, val in res_series.items():
            v = float(val) if pd.notna(val) else 0.0
            data_items.append({
                "name": str(period_key),
                "value": round(v, 2),
                "count": int(counts_series[period_key]),
            })

    else:
        # Categorical or low-cardinality discrete grouping
        grp = work_df.groupby(x_col, observed=False)
        if is_y_numeric and y_col:
            res_series = grp[y_col].agg(agg_fn)
        else:
            res_series = grp.size()
        counts_series = grp.size()

        for cat_key, val in res_series.items():
            v = float(val) if pd.notna(val) else 0.0
            data_items.append({
                "name": str(cat_key),
                "value": round(v, 2),
                "count": int(counts_series[cat_key]),
            })

        # Default sort
        if sort_by == "x_asc":
            data_items.sort(key=lambda item: str(item["name"]))
        elif sort_by == "x_desc":
            data_items.sort(key=lambda item: str(item["name"]), reverse=True)
        else:
            # For categorical bars/pies, sort by value descending
            data_items.sort(key=lambda item: item["value"], reverse=True)

    # Slice top N if requested (except for binned/line charts where order matters)
    if not should_bin and x_type != "datetime" and top_n and len(data_items) > top_n:
        top_items = data_items[:top_n]
        other_vals = data_items[top_n:]
        if other_vals and chart_type in ["pie", "donut"]:
            other_sum = sum(i["value"] for i in other_vals)
            other_cnt = sum(i["count"] for i in other_vals)
            top_items.append({
                "name": f"Other ({len(other_vals)} categories)",
                "value": round(other_sum, 2),
                "count": other_cnt
            })
        data_items = top_items

    # --- COMPUTED RELATIONSHIP INSIGHTS ---
    values_arr = [item["value"] for item in data_items]
    is_constant = len(set(values_arr)) <= 1 if values_arr else False

    insights: Dict[str, Any] = {
        "x_type": x_type,
        "is_binned": should_bin,
        "aggregation_operator": agg_fn,
        "is_constant": is_constant,
        "min_value": min(values_arr) if values_arr else 0.0,
        "max_value": max(values_arr) if values_arr else 0.0,
    }

    if is_constant:
        insights["trend_type"] = "constant"
        insights["summary_text"] = f"Values across {x_col} are uniform ({values_arr[0] if values_arr else 0}). No variance detected in active selection."
    elif x_type == "datetime" and len(values_arr) >= 2:
        start_v = values_arr[0]
        end_v = values_arr[-1]
        pct_change = ((end_v - start_v) / abs(start_v) * 100.0) if start_v != 0 else 0.0
        insights["trend_type"] = "chronological"
        insights["growth_rate"] = round(pct_change, 2)
        insights["summary_text"] = (
            f"Chronological trajectory from {data_items[0]['name']} to {data_items[-1]['name']}: "
            f"{pct_change:+.1f}% change ({start_v:,.2f} -> {end_v:,.2f})."
        )
    elif is_x_numeric and is_y_numeric and len(work_df) > 1:
        corr = float(work_df[x_col].corr(work_df[y_col]))
        corr = 0.0 if np.isnan(corr) else round(corr, 3)
        insights["trend_type"] = "numeric_relationship"
        insights["correlation"] = corr

        if corr >= 0.5:
            insights["summary_text"] = f"Strong upward relationship (r = {corr:+.2f}). As {x_col} increases, {y_col} steadily rises."
        elif corr <= -0.5:
            insights["summary_text"] = f"Strong downward relationship (r = {corr:+.2f}). As {x_col} increases, {y_col} steadily declines."
        elif abs(corr) >= 0.2:
            insights["summary_text"] = f"Moderate correlation (r = {corr:+.2f}) observed between {x_col} and {y_col}."
        else:
            insights["summary_text"] = f"Non-linear or low correlation (r = {corr:+.2f}). Variation exists across intervals without strong linear direction."
    elif len(data_items) > 0:
        high = max(data_items, key=lambda x: x["value"])
        low = min(data_items, key=lambda x: x["value"])
        insights["trend_type"] = "categorical_comparison"
        insights["summary_text"] = (
            f"Highest {agg_fn.upper()} {y_col or 'count'} in '{high['name']}' ({high['value']:,.2f}); "
            f"lowest in '{low['name']}' ({low['value']:,.2f})."
        )

    return {
        "chart_type": chart_type,
        "x_col": x_col,
        "y_col": y_col,
        "data": data_items,
        "insights": insights,
        "total_rows": len(df),
        "valid_rows": total_valid
    }
