"""
Data Drift Detection Engine for OpenDataLens.
Computes Population Stability Index (PSI), Kolmogorov-Smirnov (KS) statistics,
categorical variation distance, schema shifts, and missing-rate drift without external SaaS dependencies.
"""

import logging
from typing import Dict, Any, List, Optional
import numpy as np
import pandas as pd
from scipy import stats

logger = logging.getLogger(__name__)

PSI_STABLE_THRESHOLD = 0.10
PSI_WARNING_THRESHOLD = 0.25


def calculate_psi(
    reference: pd.Series,
    target: pd.Series,
    num_bins: int = 10,
    epsilon: float = 1e-4
) -> float:
    """
    Calculate Population Stability Index (PSI) for continuous numeric distributions.
    PSI = sum((target_pct - ref_pct) * ln(target_pct / ref_pct))
    """
    ref_clean = reference.dropna()
    tgt_clean = target.dropna()

    if len(ref_clean) < 10 or len(tgt_clean) < 5:
        return 0.0

    # Handle constant or zero-variance reference
    if ref_clean.nunique() <= 1:
        if tgt_clean.nunique() <= 1 and (ref_clean.iloc[0] == tgt_clean.iloc[0]):
            return 0.0
        return 1.0

    # Quantile bins based on reference distribution
    quantiles = np.linspace(0, 1, num_bins + 1)
    bin_edges = np.percentile(ref_clean, quantiles * 100)
    bin_edges = np.unique(bin_edges)

    if len(bin_edges) < 2:
        return 0.0

    # Extend edges to capture out-of-range target values safely
    bin_edges[0] = -np.inf
    bin_edges[-1] = np.inf

    ref_counts, _ = np.histogram(ref_clean, bins=bin_edges)
    tgt_counts, _ = np.histogram(tgt_clean, bins=bin_edges)

    # Convert to proportions with Laplace smoothing
    ref_pct = (ref_counts + epsilon) / (len(ref_clean) + epsilon * len(ref_counts))
    tgt_pct = (tgt_counts + epsilon) / (len(tgt_clean) + epsilon * len(tgt_counts))

    psi_val = np.sum((tgt_pct - ref_pct) * np.log(tgt_pct / ref_pct))
    return float(round(max(0.0, psi_val), 4))


def calculate_ks_test(reference: pd.Series, target: pd.Series) -> Dict[str, float]:
    """
    Two-sample Kolmogorov-Smirnov test for continuous distributions.
    Returns test statistic (maximum distance between CDFs) and asymptotic p-value.
    """
    ref_clean = reference.dropna()
    tgt_clean = target.dropna()

    if len(ref_clean) < 5 or len(tgt_clean) < 5:
        return {"statistic": 0.0, "p_value": 1.0}

    try:
        res = stats.ks_2samp(ref_clean, tgt_clean)
        return {
            "statistic": float(round(res.statistic, 4)),
            "p_value": float(round(res.pvalue, 4))
        }
    except Exception as e:
        logger.warning(f"KS-test failed: {e}")
        return {"statistic": 0.0, "p_value": 1.0}


def calculate_categorical_drift(reference: pd.Series, target: pd.Series) -> Dict[str, Any]:
    """
    Compute categorical drift using Total Variation Distance (TVD) and PSI across category frequencies.
    """
    ref_clean = reference.dropna().astype(str)
    tgt_clean = target.dropna().astype(str)

    all_categories = sorted(list(set(ref_clean.unique()).union(set(tgt_clean.unique()))))
    if not all_categories or len(ref_clean) == 0 or len(tgt_clean) == 0:
        return {"psi": 0.0, "tvd": 0.0, "top_shift": None}

    ref_freq = ref_clean.value_counts(normalize=True).reindex(all_categories, fill_value=0.0)
    tgt_freq = tgt_clean.value_counts(normalize=True).reindex(all_categories, fill_value=0.0)

    # Total Variation Distance: 0.5 * sum(|P - Q|)
    tvd = 0.5 * np.sum(np.abs(ref_freq.values - tgt_freq.values))

    # Categorical PSI with Laplace smoothing
    epsilon = 1e-4
    r_pct = (ref_freq.values + epsilon) / (1.0 + epsilon * len(all_categories))
    t_pct = (tgt_freq.values + epsilon) / (1.0 + epsilon * len(all_categories))
    psi = float(np.sum((t_pct - r_pct) * np.log(t_pct / r_pct)))

    # Identify largest category frequency change
    diff = (tgt_freq - ref_freq).abs()
    top_cat = diff.idxmax() if not diff.empty else None

    return {
        "psi": float(round(max(0.0, psi), 4)),
        "tvd": float(round(tvd, 4)),
        "top_shifted_category": str(top_cat) if top_cat is not None else None,
        "max_category_diff": float(round(diff.max(), 4)) if not diff.empty else 0.0
    }


def detect_dataset_drift(
    reference_df: pd.DataFrame,
    target_df: pd.DataFrame
) -> Dict[str, Any]:
    """
    Comprehensive drift evaluation comparing a reference baseline dataset to a target dataset.
    """
    ref_cols = set(reference_df.columns)
    tgt_cols = set(target_df.columns)

    removed_cols = sorted(list(ref_cols - tgt_cols))
    added_cols = sorted(list(tgt_cols - ref_cols))
    common_cols = [c for c in reference_df.columns if c in tgt_cols]

    missing_shifts: Dict[str, Dict[str, float]] = {}
    feature_metrics: List[Dict[str, Any]] = []

    psi_values: List[float] = []
    drifted_count = 0
    warning_count = 0

    for col in common_cols:
        r_col = reference_df[col]
        t_col = target_df[col]

        # Missing value shift
        r_missing = float(round(r_col.isna().mean() * 100, 2))
        t_missing = float(round(t_col.isna().mean() * 100, 2))
        missing_diff = round(t_missing - r_missing, 2)
        if abs(missing_diff) >= 5.0:
            missing_shifts[col] = {
                "reference_pct": r_missing,
                "target_pct": t_missing,
                "diff_pct": missing_diff
            }

        is_numeric = pd.api.types.is_numeric_dtype(r_col) and pd.api.types.is_numeric_dtype(t_col)

        if is_numeric:
            psi = calculate_psi(r_col, t_col)
            ks = calculate_ks_test(r_col, t_col)

            ref_mean = float(round(r_col.mean(), 3)) if not r_col.dropna().empty else 0.0
            tgt_mean = float(round(t_col.mean(), 3)) if not t_col.dropna().empty else 0.0
            ref_std = float(round(r_col.std(), 3)) if len(r_col.dropna()) > 1 else 0.0
            tgt_std = float(round(t_col.std(), 3)) if len(t_col.dropna()) > 1 else 0.0

            if psi >= PSI_WARNING_THRESHOLD:
                status = "drifted"
                drifted_count += 1
                rec = f"Severe distribution shift detected (PSI={psi:.2f}, KS p={ks['p_value']:.4f}). Consider updating training data."
            elif psi >= PSI_STABLE_THRESHOLD:
                status = "warning"
                warning_count += 1
                rec = f"Moderate distribution shift detected (PSI={psi:.2f}). Monitor feature performance in downstream predictions."
            else:
                status = "stable"
                rec = "Distribution matches reference baseline within normal statistical variance."

            feature_metrics.append({
                "feature": col,
                "type": "numeric",
                "psi": psi,
                "ks_statistic": ks["statistic"],
                "ks_p_value": ks["p_value"],
                "status": status,
                "reference_stats": {"mean": ref_mean, "std": ref_std, "missing_pct": r_missing},
                "target_stats": {"mean": tgt_mean, "std": tgt_std, "missing_pct": t_missing},
                "recommendation": rec
            })
            psi_values.append(psi)
        else:
            cat_drift = calculate_categorical_drift(r_col, t_col)
            psi = cat_drift["psi"]

            if psi >= PSI_WARNING_THRESHOLD:
                status = "drifted"
                drifted_count += 1
                rec = f"Significant category frequency shift (TVD={cat_drift['tvd']:.2f}, top shift in '{cat_drift['top_shifted_category']}')."
            elif psi >= PSI_STABLE_THRESHOLD:
                status = "warning"
                warning_count += 1
                rec = f"Moderate category variation (TVD={cat_drift['tvd']:.2f}). Verify representation across groups."
            else:
                status = "stable"
                rec = "Categorical frequencies are consistent with reference baseline."

            feature_metrics.append({
                "feature": col,
                "type": "categorical",
                "psi": psi,
                "tvd": cat_drift["tvd"],
                "top_shifted_category": cat_drift["top_shifted_category"],
                "status": status,
                "reference_stats": {"unique_categories": int(r_col.nunique()), "missing_pct": r_missing},
                "target_stats": {"unique_categories": int(t_col.nunique()), "missing_pct": t_missing},
                "recommendation": rec
            })
            psi_values.append(psi)

    # Sort features by PSI descending
    feature_metrics.sort(key=lambda x: x["psi"], reverse=True)

    mean_psi = float(round(np.mean(psi_values), 4)) if psi_values else 0.0

    if drifted_count >= max(1, int(len(common_cols) * 0.3)) or mean_psi >= PSI_WARNING_THRESHOLD:
        overall_status = "significant_drift"
        badge_label = "Significant Drift"
        summary = (
            f"Detected significant drift across {drifted_count} features (mean PSI: {mean_psi:.2f}). "
            "Distribution changes may impact model accuracy; evaluate model performance on fresh target ground truth."
        )
    elif warning_count > 0 or mean_psi >= PSI_STABLE_THRESHOLD:
        overall_status = "moderate_drift"
        badge_label = "Moderate Shift"
        summary = (
            f"Moderate distribution shifts detected in {warning_count} features (mean PSI: {mean_psi:.2f}). "
            "Feature behavior has evolved but is within acceptable variance. Recommend periodic monitoring."
        )
    else:
        overall_status = "stable"
        badge_label = "Stable Baseline"
        summary = (
            f"Dataset distributions are stable (mean PSI: {mean_psi:.2f}). "
            "Target dataset aligns closely with the reference training distribution."
        )

    return {
        "overall_status": overall_status,
        "badge_label": badge_label,
        "summary": summary,
        "mean_psi": mean_psi,
        "drifted_features_count": drifted_count,
        "warning_features_count": warning_count,
        "stable_features_count": len(common_cols) - drifted_count - warning_count,
        "total_features_evaluated": len(common_cols),
        "reference_rows": len(reference_df),
        "target_rows": len(target_df),
        "schema_changes": {
            "removed_columns": removed_cols,
            "added_columns": added_cols,
            "common_columns_count": len(common_cols)
        },
        "missing_value_shifts": missing_shifts,
        "features": feature_metrics
    }
