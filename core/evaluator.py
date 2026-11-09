"""
Model Evaluation and Multi-Model Comparison Studio for OpenDataLens
Calculates performance metrics, confusion matrices, residual plots data,
and automated best-model selection.
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


def evaluate_classification_model(
    pipeline: Any,
    X_test: pd.DataFrame,
    y_test: pd.Series,
    model_display_name: str = "Classifier",
    fit_time: float = 0.0
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

    return {
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
        "ground_truth": y_test.tolist()
    }


def evaluate_regression_model(
    pipeline: Any,
    X_test: pd.DataFrame,
    y_test: pd.Series,
    model_display_name: str = "Regressor",
    fit_time: float = 0.0
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

    return {
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

        if problem_type == "classification":
            rows.append({
                "Model": name,
                "Accuracy": metrics.get("accuracy", 0.0),
                "F1 Score (Macro)": metrics.get("f1_macro", 0.0),
                "Precision (Macro)": metrics.get("precision_macro", 0.0),
                "Recall (Macro)": metrics.get("recall_macro", 0.0),
                "Training Time (s)": fit_time
            })
        else:
            rows.append({
                "Model": name,
                "R² Score": metrics.get("r2", 0.0),
                "RMSE": metrics.get("rmse", 0.0),
                "MAE": metrics.get("mae", 0.0),
                "MSE": metrics.get("mse", 0.0),
                "Training Time (s)": fit_time
            })

    df = pd.DataFrame(rows)
    if not df.empty:
        # Sort by primary metric
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
        # Look for F1 or Accuracy
        target_metric = "F1 Score (Macro)" if "F1 Score (Macro)" in comparison_df.columns else "Accuracy"
        best_row = comparison_df.loc[comparison_df[target_metric].idxmax()]
        return str(best_row["Model"]), target_metric, float(best_row[target_metric])
    else:
        target_metric = "R² Score" if "R² Score" in comparison_df.columns else comparison_df.columns[1]
        best_row = comparison_df.loc[comparison_df[target_metric].idxmax()]
        return str(best_row["Model"]), target_metric, float(best_row[target_metric])
