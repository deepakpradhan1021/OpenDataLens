"""
Machine Learning Studio Page for OpenDataLens
Supports leak-free preprocessing, feature & target selection,
train/test splitting, and multi-model training.
"""

import streamlit as st
import pandas as pd
from core.ml_studio import (
    detect_target_candidates,
    prepare_train_test_split,
    train_model_pipeline
)
from core.evaluator import (
    evaluate_classification_model,
    evaluate_regression_model,
    build_comparison_table
)
from core.config import CLASSIFICATION_MODELS, REGRESSION_MODELS
from ui.components import render_kpi_card, render_alert, render_empty_state, render_header_banner


def render_ml_studio():
    render_header_banner(
        title="Machine Learning Studio",
        subtitle="Automated feature preprocessing, leak-free pipeline construction, and baseline model training."
    )

    if "dataset" not in st.session_state or st.session_state["dataset"] is None:
        render_empty_state(
            title="No Active Dataset Available",
            description="Please load a dataset in the Dataset Explorer tab before configuring machine learning models.",
            action_suggestion="Navigate to 'Dataset Explorer' to load a benchmark or file."
        )
        return

    df = st.session_state["dataset"]
    dataset_meta = st.session_state.get("dataset_metadata", {})

    # Detect target candidates
    target_candidates = detect_target_candidates(df)
    suggested_task = dataset_meta.get("task", "classification")
    if suggested_task not in ["classification", "regression"]:
        suggested_task = "classification" if target_candidates["classification"] else "regression"

    st.markdown("### 1. Problem Definition & Target Specification")

    col_prob, col_target = st.columns([1, 2])
    with col_prob:
        problem_type = st.selectbox(
            "Predictive Task Type:",
            options=["classification", "regression"],
            index=0 if suggested_task == "classification" else 1,
            format_func=lambda x: "Classification (Discrete Classes)" if x == "classification" else "Regression (Continuous Target)"
        )

    # Suggest suitable targets based on chosen problem type
    valid_targets = target_candidates[problem_type] or df.columns.tolist()
    # Check if dataset metadata had a pre-specified target
    default_target_idx = 0
    if dataset_meta.get("suggested_target") in df.columns:
        default_target_idx = df.columns.tolist().index(dataset_meta["suggested_target"])
    elif valid_targets and valid_targets[0] in df.columns:
        default_target_idx = df.columns.tolist().index(valid_targets[0])

    with col_target:
        target_col = st.selectbox(
            "Target Column (Dependent Variable):",
            options=df.columns.tolist(),
            index=default_target_idx
        )

    # Target sanity display
    target_series = df[target_col].dropna()
    if problem_type == "classification":
        n_classes = target_series.nunique()
        st.caption(f"Target contains **{n_classes}** classes across {len(target_series):,} valid labels.")
        if n_classes < 2:
            st.error("Selected target has fewer than 2 classes. Machine learning classification requires at least 2 distinct classes.")
            return
    else:
        st.caption(f"Target range: [{target_series.min():.2f} to {target_series.max():.2f}], Mean: {target_series.mean():.2f}")

    st.markdown("---")
    st.markdown("### 2. Feature Selection & Preprocessing Settings")

    # Smart default features excluding target and potential ID columns
    all_cols = [c for c in df.columns if c != target_col]
    id_cols = [c for c in all_cols if any(k in c.lower() for k in ["id", "uuid", "guid", "index"])]
    default_features = [c for c in all_cols if c not in id_cols] or all_cols

    feature_cols = st.multiselect(
        "Select Predictive Features:",
        options=all_cols,
        default=default_features,
        help="Features will undergo automated median/mode imputation and transformation safely inside Scikit-learn pipelines."
    )

    if not feature_cols:
        st.warning("Please select at least one predictive feature.")
        return

    col_p1, col_p2, col_p3 = st.columns(3)
    with col_p1:
        scaler_choice = st.selectbox(
            "Numerical Scaler:",
            options=["standard", "robust", "minmax"],
            format_func=lambda x: {
                "standard": "StandardScaler (Z-Score)",
                "robust": "RobustScaler (Outlier-Resistant)",
                "minmax": "MinMaxScaler (0 to 1)"
            }[x]
        )
    with col_p2:
        test_size = st.slider(
            "Test Set Ratio:",
            min_value=0.10,
            max_value=0.40,
            value=0.20,
            step=0.05,
            format="%.2f"
        )
    with col_p3:
        random_seed = st.number_input("Random Seed:", value=42, step=1)

    render_alert(
        title="Zero Data Leakage Guarantee",
        description="Imputers, Scalers, and Categorical Encoders are fitted strictly on the training partition (`X_train`) and only transform testing data (`X_test`).",
        alert_type="info"
    )

    st.markdown("---")
    st.markdown("### 3. Model Architecture Selection")

    available_models = CLASSIFICATION_MODELS if problem_type == "classification" else REGRESSION_MODELS
    selected_models = []

    m_cols = st.columns(3)
    for idx, (m_key, m_label) in enumerate(available_models.items()):
        col = m_cols[idx % 3]
        with col:
            # Default to selecting standard baseline models
            is_checked = m_key in ["logistic_regression", "random_forest", "gradient_boosting", "ridge_regression", "decision_tree"]
            if st.checkbox(m_label, value=is_checked, key=f"chk_model_{m_key}"):
                selected_models.append(m_key)

    if not selected_models:
        st.warning("Please select at least one model architecture to train.")
        return

    st.markdown("---")
    col_t1, col_t2 = st.columns([3, 1])
    with col_t1:
        st.markdown(f"**Ready to train {len(selected_models)} model(s)** on {len(feature_cols)} features.")
    with col_t2:
        train_clicked = st.button("Train Models", type="primary", use_container_width=True)

    if train_clicked:
        progress_bar = st.progress(0)
        status_text = st.empty()

        try:
            status_text.text("Partitioning data into train and test splits...")
            X_train, X_test, y_train, y_test = prepare_train_test_split(
                df=df,
                feature_cols=feature_cols,
                target_col=target_col,
                test_size=test_size,
                random_state=random_seed,
                problem_type=problem_type
            )
            progress_bar.progress(15)

            trained_models_dict = {}
            evaluations_dict = {}

            n_models = len(selected_models)
            for i, model_key in enumerate(selected_models):
                model_label = available_models[model_key]
                status_text.text(f"Training {model_label} ({i+1}/{n_models})...")

                pipe, fit_time = train_model_pipeline(
                    model_name=model_key,
                    problem_type=problem_type,
                    X_train=X_train,
                    y_train=y_train,
                    scaler_type=scaler_choice,
                    random_state=random_seed
                )

                # Evaluate immediately on unseen test set
                if problem_type == "classification":
                    eval_res = evaluate_classification_model(
                        pipeline=pipe,
                        X_test=X_test,
                        y_test=y_test,
                        model_display_name=model_label,
                        fit_time=fit_time
                    )
                else:
                    eval_res = evaluate_regression_model(
                        pipeline=pipe,
                        X_test=X_test,
                        y_test=y_test,
                        model_display_name=model_label,
                        fit_time=fit_time
                    )

                trained_models_dict[model_key] = pipe
                evaluations_dict[model_key] = eval_res

                pct = 15 + int(((i + 1) / n_models) * 80)
                progress_bar.progress(pct)

            # Build comparison table
            comp_df = build_comparison_table(evaluations_dict, problem_type=problem_type)

            # Save state
            st.session_state["trained_models"] = trained_models_dict
            st.session_state["model_evaluations"] = evaluations_dict
            st.session_state["comparison_df"] = comp_df
            st.session_state["ml_meta"] = {
                "problem_type": problem_type,
                "target_col": target_col,
                "feature_cols": feature_cols,
                "test_size": test_size,
                "scaler": scaler_choice,
                "X_test": X_test,
                "y_test": y_test
            }

            progress_bar.progress(100)
            status_text.text("Training and evaluation completed successfully!")
            st.success(f"Trained and evaluated {len(selected_models)} models! Proceed to 'Model Comparison' to review results.")

        except Exception as e:
            st.error(f"Error encountered during model training: {str(e)}")
            progress_bar.empty()
            status_text.empty()

    # If models are already trained in this session, show a summary notice
    if "model_evaluations" in st.session_state and st.session_state["model_evaluations"]:
        n_trained = len(st.session_state["model_evaluations"])
        st.info(f"{n_trained} trained model(s) currently cached in active session. Switch to the 'Model Comparison' page to view detailed scoreboards and charts.")
