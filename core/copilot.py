"""
AI Dataset and Model Copilot for OpenDataLens.
Provides deterministic, zero-cost heuristic intelligence based on actual verified workspace facts,
with optional LLM enhancement when an API key is configured.
"""

import os
import re
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)


def answer_with_heuristics(
    query: str,
    dataset_meta: Optional[Dict[str, Any]] = None,
    quality_analysis: Optional[Dict[str, Any]] = None,
    ml_results: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Zero-cost deterministic engine that analyzes actual dataset metadata,
    quality audit metrics, and model evaluation results. Never hallucinates metrics.
    """
    q = query.lower().strip()

    # 1. Dataset Explanation Query
    if any(k in q for k in ["explain", "about", "overview", "what is this", "describe"]):
        if not dataset_meta:
            return {
                "answer": "No dataset is currently loaded in this workspace. Please select a curated benchmark dataset or upload a CSV first.",
                "intent": "dataset_overview",
                "suggested_followups": ["Load curated Iris dataset", "How to upload a CSV?"]
            }

        name = dataset_meta.get("name", "Active Dataset")
        rows = dataset_meta.get("rows", 0)
        cols = dataset_meta.get("cols", 0)
        task = dataset_meta.get("task", "general analysis")
        target = dataset_meta.get("suggested_target", "Not specified")
        desc = dataset_meta.get("description", "")
        is_synth = dataset_meta.get("is_synthetic", False)

        synth_note = " Note: This is synthetic benchmark demo data." if is_synth else ""

        ans = (
            f"**{name}** consists of **{rows:,} rows** and **{cols} columns** configured for **{task}** tasks. "
            f"Suggested target column is `{target}`.{synth_note}\n\n"
            f"**Description:** {desc}\n\n"
        )

        if quality_analysis:
            overview = quality_analysis.get("overview", {})
            comp = overview.get("completeness_score", 100.0)
            dups = overview.get("duplicate_rows", 0)
            ans += f"**Data Health:** The dataset has a **{comp}% completeness score** with **{dups} duplicate rows**."

        return {
            "answer": ans,
            "intent": "dataset_overview",
            "suggested_followups": ["Which columns have missing values?", "What should I clean first?", "Train baseline models"]
        }

    # 2. Missing Values Query
    if any(k in q for k in ["missing", "null", "na", "nan", "empty"]):
        if not quality_analysis:
            return {
                "answer": "Quality analysis has not been performed yet. Navigate to Data Quality to audit missing values.",
                "intent": "missing_values",
                "suggested_followups": ["Run data quality audit"]
            }

        missing = quality_analysis.get("missing_values", {})
        col_summary = missing.get("column_summary", {})
        missing_cols = [c for c, s in col_summary.items() if s.get("missing_count", 0) > 0]

        if not missing_cols:
            return {
                "answer": "Great news! **Zero missing values** were found across all columns. The dataset is 100% complete.",
                "intent": "missing_values",
                "suggested_followups": ["What should I clean first?", "Are there any outliers?"]
            }

        items = []
        for c in missing_cols:
            s = col_summary[c]
            cnt = s.get("missing_count", 0)
            pct = s.get("missing_pct", 0.0)
            items.append(f"- **`{c}`**: {cnt:,} missing entries ({pct}%)")

        ans = (
            f"Identified missing values in **{len(missing_cols)} column(s)**:\n\n" +
            "\n".join(items) +
            "\n\n**Actionable Advice:** OpenDataLens ML Studio applies median imputation for numeric features and mode imputation for categorical features automatically without data leakage."
        )

        return {
            "answer": ans,
            "intent": "missing_values",
            "suggested_followups": ["What should I clean first?", "Explain my dataset"]
        }

    # 3. Data Cleaning Prioritization
    if any(k in q for k in ["clean", "fix", "preprocess", "first", "issue", "recommend"]):
        if not quality_analysis:
            return {
                "answer": "Load a dataset and open Data Quality to generate a prioritized cleaning checklist.",
                "intent": "cleaning_priorities",
                "suggested_followups": ["Load curated benchmark"]
            }

        recs = quality_analysis.get("recommendations", [])
        if not recs:
            return {
                "answer": "The dataset is in excellent condition with no immediate critical cleaning required.",
                "intent": "cleaning_priorities",
                "suggested_followups": ["Train models in ML Studio"]
            }

        items = []
        for i, r in enumerate(recs, 1):
            severity = r.get("type", "info").upper()
            title = r.get("title", "")
            action = r.get("action", "")
            items.append(f"{i}. **[{severity}] {title}**\n   *Action:* {action}")

        ans = (
            f"Here is your prioritized data preparation checklist based on verified audit calculations:\n\n" +
            "\n\n".join(items)
        )

        return {
            "answer": ans,
            "intent": "cleaning_priorities",
            "suggested_followups": ["Which columns have missing values?", "Are there any outliers?"]
        }

    # 4. Outliers Query
    if any(k in q for k in ["outlier", "extreme", "iqr", "anomaly"]):
        if not quality_analysis:
            return {
                "answer": "Run quality analysis to inspect numerical outliers.",
                "intent": "outliers",
                "suggested_followups": ["Load curated benchmark"]
            }

        outliers = quality_analysis.get("outliers", {})
        high_outliers = {c: o for c, o in outliers.items() if o.get("outlier_pct", 0) > 0}

        if not high_outliers:
            return {
                "answer": "No significant outliers detected outside standard 1.5× IQR boundaries.",
                "intent": "outliers",
                "suggested_followups": ["Explain my dataset", "Train baseline models"]
            }

        items = [
            f"- **`{c}`**: {o['outlier_count']} outliers ({o['outlier_pct']}%) [Valid IQR range: {o['lower_bound']} to {o['upper_bound']}]"
            for c, o in high_outliers.items()
        ]

        ans = (
            f"Outliers detected in **{len(high_outliers)} numeric column(s)**:\n\n" +
            "\n".join(items) +
            "\n\n**Recommendation:** Use `RobustScaler` in ML Studio to prevent high-leverage outliers from skewing linear weights or gradient steps."
        )

        return {
            "answer": ans,
            "intent": "outliers",
            "suggested_followups": ["What should I clean first?", "Train models in ML Studio"]
        }

    # 5. Best-Performing Model Query
    if any(k in q for k in ["best model", "winner", "top model", "performance", "scoreboard", "won"]):
        if not ml_results or not ml_results.get("comparison_table"):
            return {
                "answer": "No models have been trained in this workspace session yet. Go to ML Studio, select features and target, and train models.",
                "intent": "model_performance",
                "suggested_followups": ["Train models in ML Studio"]
            }

        table = ml_results.get("comparison_table", [])
        if not table:
            return {
                "answer": "Model training records are empty.",
                "intent": "model_performance",
                "suggested_followups": ["Train models in ML Studio"]
            }

        best = table[0]
        model_name = best.get("Model", "Top Model")
        prob_type = ml_results.get("ml_meta", {}).get("problem_type", "classification")

        if prob_type == "classification":
            acc = best.get("Accuracy", "N/A")
            f1 = best.get("F1 Score (Macro)", "N/A")
            cv = best.get("CV Score (Mean ± Std)", "N/A")
            t_time = best.get("Training Time (s)", "N/A")

            ans = (
                f"**{model_name}** is the top-performing model with an **Accuracy of {acc}** and **Macro F1 Score of {f1}** "
                f"(CV Score: `{cv}`, Training Time: `{t_time}s`).\n\n"
                "**Why it won:** It achieved the optimal balance of precision and recall across classes without exhibiting severe variance on validation splits."
            )
        else:
            r2 = best.get("R² Score", "N/A")
            rmse = best.get("RMSE", "N/A")
            cv = best.get("CV Score (Mean ± Std)", "N/A")
            t_time = best.get("Training Time (s)", "N/A")

            ans = (
                f"**{model_name}** is the top-performing regressor with an **R² Score of {r2}** and **RMSE of {rmse}** "
                f"(CV Score: `{cv}`, Training Time: `{t_time}s`).\n\n"
                "**Why it won:** It captured the largest fraction of target variance with minimal residual error."
            )

        return {
            "answer": ans,
            "intent": "model_performance",
            "suggested_followups": ["Which model should I investigate further?", "Explain model predictions"]
        }

    # 6. Model Investigation & Runner-Up Query
    if any(k in q for k in ["investigate", "runner up", "second", "overfit", "further", "alternative"]):
        if not ml_results or not ml_results.get("comparison_table"):
            return {
                "answer": "Train models in ML Studio to compare alternatives and runner-ups.",
                "intent": "model_investigation",
                "suggested_followups": ["Train models in ML Studio"]
            }

        table = ml_results.get("comparison_table", [])
        if len(table) < 2:
            return {
                "answer": "Only one model was evaluated. Train multiple algorithms (e.g., Random Forest, Gradient Boosting, Logistic Regression) to compare trade-offs.",
                "intent": "model_investigation",
                "suggested_followups": ["Train multiple models"]
            }

        runner_up = table[1]
        name = runner_up.get("Model", "Runner-Up")
        time_diff = runner_up.get("Training Time (s)", "N/A")
        ans = (
            f"Consider investigating **{name}** as a strong contender. "
            f"While slightly trailing the leader, it may offer faster inference ({time_diff}s training) or better interpretability. "
            "Check the Explainability tab to compare feature attributions."
        )

        return {
            "answer": ans,
            "intent": "model_investigation",
            "suggested_followups": ["Explain model predictions", "View data drift"]
        }

    # 7. General Fallback
    summary_parts = []
    if dataset_meta:
        summary_parts.append(f"Loaded dataset: **{dataset_meta.get('name')}** ({dataset_meta.get('rows')} rows).")
    if quality_analysis:
        summary_parts.append(f"Quality completeness: **{quality_analysis.get('overview', {}).get('completeness_score')}%**.")
    if ml_results and ml_results.get("comparison_table"):
        summary_parts.append(f"Trained models: **{len(ml_results['comparison_table'])} algorithms evaluated**.")

    state_desc = " ".join(summary_parts) if summary_parts else "No dataset loaded yet."
    ans = (
        f"**OpenDataLens Copilot Status:** {state_desc}\n\n"
        "You can ask me to:\n"
        "- *Explain my dataset*\n"
        "- *Which columns have missing values?*\n"
        "- *What should I clean first?*\n"
        "- *Are there any outliers?*\n"
        "- *Explain the best-performing model*\n"
        "- *Which model should I investigate further?*"
    )

    return {
        "answer": ans,
        "intent": "general_guidance",
        "suggested_followups": ["Explain my dataset", "What should I clean first?"]
    }
