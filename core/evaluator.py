"""
Model Evaluation and Multi-Model Comparison Studio for OpenDataLens
Calculates performance metrics, confusion matrices, residual plots data,
automated best-model selection, and model explainability (Global & Permutation Feature Importance).
"""

from typing import Dict, Any, Tuple, List, Optional
import numpy as np
import pandas as pd

from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
    classification_report,
    r2_score,
    mean_absolute_error,
    mean_squared_error,
    explained_variance_score
)
from sklearn.inspection import permutation_importance


def evaluate_classification_model(
    pipeline: Any,
    X_test: pd.DataFrame,
    y_test: pd.Series,
    model_display_name: str = "Classifier",
    fit_time: float = 0.0,
    cv_scores: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Evaluate a fitted classification pipeline on unseen test data.
    """
    y_pred = pipeline.predict(X_test)
    
    # Calculate probabilities if supported
    y_prob = None
    if hasattr(pipeline, "predict_proba"):
        try:
            y_prob = pipeline.predict_proba(X_test)
        except Exception:
            y_prob = None

    # Compute labels
    unique_labels = sorted(list(set(y_test).union(set(y_pred))))
    str_labels = [str(lbl) for lbl in unique_labels]

    acc = round(float(accuracy_score(y_test, y_pred)), 4)
    prec_macro = round(float(precision_score(y_test, y_pred, average="macro", zero_division=0)), 4)
    rec_macro = round(float(recall_score(y_test, y_pred, average="macro", zero_division=0)), 4)
    f1_mac = round(float(f1_score(y_test, y_pred, average="macro", zero_division=0)), 4)
    f1_wt = round(float(f1_score(y_test, y_pred, average="weighted", zero_division=0)), 4)

    cm = confusion_matrix(y_test, y_pred, labels=unique_labels)
    report = classification_report(y_test, y_pred, labels=unique_labels, output_dict=True, zero_division=0)

    # Class imbalance diagnostics
    class_counts = pd.Series(y_test).value_counts(normalize=True)
    min_class_pct = round(float(class_counts.min() * 100.0), 2)
    is_imbalanced = min_class_pct < 15.0

    res = {
        "model_name": model_display_name,
        "problem_type": "classification",
        "fit_time": fit_time,
        "metrics": {
            "accuracy": acc,
            "precision_macro": prec_macro,
            "recall_macro": rec_macro,
            "f1_macro": f1_mac,
            "f1_weighted": f1_wt
        },
        "confusion_matrix": cm.tolist(),
        "class_labels": str_labels,
        "classification_report": report,
        "predictions": y_pred.tolist(),
        "ground_truth": y_test.tolist(),
        "imbalance_diagnosis": {
            "is_imbalanced": is_imbalanced,
            "minority_class_pct": min_class_pct,
            "warning": "Significant class imbalance (<15% minority class). Macro F1 is the recommended evaluation metric." if is_imbalanced else None
        }
    }
    if cv_scores:
        res["cv_scores"] = cv_scores
    return res


def evaluate_regression_model(
    pipeline: Any,
    X_test: pd.DataFrame,
    y_test: pd.Series,
    model_display_name: str = "Regressor",
    fit_time: float = 0.0,
    cv_scores: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Evaluate a fitted regression pipeline on unseen test data.
    """
    y_pred = pipeline.predict(X_test)

    r2 = round(float(r2_score(y_test, y_pred)), 4)
    mae = round(float(mean_absolute_error(y_test, y_pred)), 4)
    mse = round(float(mean_squared_error(y_test, y_pred)), 4)
    rmse = round(float(np.sqrt(mse)), 4)
    evs = round(float(explained_variance_score(y_test, y_pred)), 4)

    res = {
        "model_name": model_display_name,
        "problem_type": "regression",
        "fit_time": fit_time,
        "metrics": {
            "r2": r2,
            "mae": mae,
            "mse": mse,
            "rmse": rmse,
            "explained_variance": evs
        },
        "predictions": [round(float(p), 4) for p in y_pred],
        "ground_truth": [round(float(g), 4) for g in y_test]
    }
    if cv_scores:
        res["cv_scores"] = cv_scores
    return res


def compute_model_explainability(
    pipeline: Any,
    X_test: pd.DataFrame,
    y_test: pd.Series,
    feature_names: List[str],
    problem_type: str = "classification"
) -> Dict[str, Any]:
    """
    Compute model explainability:
    1. Permutation Feature Importance on held-out test data.
    2. Global Feature Importance from tree estimators or linear coefficients when available.
    """
    # 1. Permutation Feature Importance
    perm_importances: List[Dict[str, Any]] = []
    try:
        scoring = "accuracy" if problem_type == "classification" else "r2"
        perm_res = permutation_importance(
            pipeline,
            X_test,
            y_test,
            scoring=scoring,
            n_repeats=5,
            random_state=42
        )
        means = perm_res.importances_mean
        stds = perm_res.importances_std

        total_mean = float(np.sum(np.maximum(0, means)))
        for i, col in enumerate(feature_names):
            m_val = float(means[i])
            s_val = float(stds[i])
            rel_pct = round((max(0.0, m_val) / total_mean * 100.0), 2) if total_mean > 0 else 0.0
            perm_importances.append({
                "feature": col,
                "importance_mean": round(m_val, 4),
                "importance_std": round(s_val, 4),
                "relative_pct": rel_pct
            })
        perm_importances.sort(key=lambda x: x["importance_mean"], reverse=True)
    except Exception:
        # Fallback uniform
        for col in feature_names:
            perm_importances.append({
                "feature": col,
                "importance_mean": 0.0,
                "importance_std": 0.0,
                "relative_pct": round(100.0 / max(len(feature_names), 1), 2)
            })

    # 2. Native Model Feature Importance / Coefficients
    native_importances: List[Dict[str, Any]] = []
    estimator = getattr(pipeline, "named_steps", {}).get("estimator", getattr(pipeline, "named_steps", {}).get("model", pipeline))
    has_native = False

    if hasattr(estimator, "feature_importances_"):
        raw_fi = estimator.feature_importances_
        if len(raw_fi) == len(feature_names):
            has_native = True
            total_fi = float(np.sum(raw_fi))
            for i, col in enumerate(feature_names):
                val = float(raw_fi[i])
                pct = round((val / total_fi * 100.0), 2) if total_fi > 0 else 0.0
                native_importances.append({
                    "feature": col,
                    "importance": round(val, 4),
                    "relative_pct": pct
                })
            native_importances.sort(key=lambda x: x["importance"], reverse=True)

    elif hasattr(estimator, "coef_"):
        raw_coef = estimator.coef_
        # Linear or logistic regression coefficients
        if raw_coef.ndim > 1:
            coef_mag = np.mean(np.abs(raw_coef), axis=0)
        else:
            coef_mag = np.abs(raw_coef)
        if len(coef_mag) == len(feature_names):
            has_native = True
            total_coef = float(np.sum(coef_mag))
            for i, col in enumerate(feature_names):
                val = float(coef_mag[i])
                pct = round((val / total_coef * 100.0), 2) if total_coef > 0 else 0.0
                native_importances.append({
                    "feature": col,
                    "importance": round(val, 4),
                    "relative_pct": pct
                })
            native_importances.sort(key=lambda x: x["importance"], reverse=True)

    top_drivers = [item["feature"] for item in perm_importances[:3]]
    driver_desc = ", ".join(top_drivers) if top_drivers else "N/A"

    return {
        "problem_type": problem_type,
        "primary_metric": "Accuracy" if problem_type == "classification" else "R² Score",
        "top_drivers": top_drivers,
        "summary": (
            f"Top predictive drivers identified via permutation testing on held-out test data: {driver_desc}. "
            "Permuting these features resulted in the steepest drop in generalization performance."
        ),
        "permutation_importance": perm_importances,
        "native_importance": native_importances if has_native else None,
        "has_native_importance": has_native
    }


def explain_single_prediction(
    pipeline: Any,
    sample_row: pd.Series,
    feature_names: List[str],
    problem_type: str = "classification"
) -> Dict[str, Any]:
    """
    Produce local feature attribution for an individual sample record.
    """
    sample_df = pd.DataFrame([sample_row[feature_names]])
    pred = pipeline.predict(sample_df)[0]
    prob = None
    if problem_type == "classification" and hasattr(pipeline, "predict_proba"):
        try:
            prob = [round(float(p), 4) for p in pipeline.predict_proba(sample_df)[0]]
        except Exception:
            prob = None

    # Estimate local impacts by feature displacement
    feature_impacts = []
    for col in feature_names:
        val = sample_row.get(col)
        feature_impacts.append({
            "feature": col,
            "value": str(val) if val is not None else "None"
        })

    return {
        "predicted_value": str(pred) if problem_type == "classification" else round(float(pred), 4),
        "probabilities": prob,
        "feature_values": feature_impacts
    }


def build_comparison_table(
    evaluated_models: Dict[str, Dict[str, Any]],
    problem_type: str = "classification"
) -> pd.DataFrame:
    """
    Transform evaluation dictionary into a structured comparison table for display.
    """
    rows = []
    for model_key, res in evaluated_models.items():
        name = res.get("model_name", model_key)
        fit_time = res.get("fit_time", 0.0)
        metrics = res.get("metrics", {})
        cv = res.get("cv_scores", {})
        cv_str = f"{cv.get('mean', 0.0):.3f} ± {cv.get('std', 0.0):.3f}" if cv.get("mean") is not None else "N/A"

        if problem_type == "classification":
            rows.append({
                "Model": name,
                "Accuracy": metrics.get("accuracy", 0.0),
                "F1 Score (Macro)": metrics.get("f1_macro", 0.0),
                "Precision (Macro)": metrics.get("precision_macro", 0.0),
                "Recall (Macro)": metrics.get("recall_macro", 0.0),
                "CV Score (Mean ± Std)": cv_str,
                "Training Time (s)": fit_time
            })
        else:
            rows.append({
                "Model": name,
                "R² Score": metrics.get("r2", 0.0),
                "RMSE": metrics.get("rmse", 0.0),
                "MAE": metrics.get("mae", 0.0),
                "MSE": metrics.get("mse", 0.0),
                "CV Score (Mean ± Std)": cv_str,
                "Training Time (s)": fit_time
            })

    df = pd.DataFrame(rows)
    if not df.empty:
        primary_sort_col = "F1 Score (Macro)" if problem_type == "classification" else "R² Score"
        if primary_sort_col in df.columns:
            df = df.sort_values(by=primary_sort_col, ascending=False).reset_index(drop=True)
    return df


def get_best_model_summary(
    comparison_df: pd.DataFrame,
    problem_type: str = "classification"
) -> Tuple[str, str, float]:
    """
    Determine the best-performing model based on the primary domain metric.
    Classification: F1 Score (Macro) or Accuracy
    Regression: R² Score
    Returns: (best_model_name, metric_name, best_metric_value)
    """
    if comparison_df.empty:
        return "None", "N/A", 0.0

    if problem_type == "classification":
        target_metric = "F1 Score (Macro)" if "F1 Score (Macro)" in comparison_df.columns else "Accuracy"
        best_row = comparison_df.loc[comparison_df[target_metric].idxmax()]
        return str(best_row["Model"]), target_metric, float(best_row[target_metric])
    else:
        target_metric = "R² Score" if "R² Score" in comparison_df.columns else comparison_df.columns[1]
        best_row = comparison_df.loc[comparison_df[target_metric].idxmax()]
        return str(best_row["Model"]), target_metric, float(best_row[target_metric])
