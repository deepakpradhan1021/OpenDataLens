"""
End-to-End Integration Tests for OpenDataLens
Tests the full lifecycle: Load -> Analyze -> Split -> Train -> Evaluate -> Compare -> Report -> Export
"""

import io
import joblib
import pandas as pd
from core.dataset_loader import load_curated_dataset, load_csv_dataset
from core.quality_analyzer import analyze_data_quality, generate_quality_recommendations
from core.ml_studio import (
    detect_target_candidates,
    prepare_train_test_split,
    train_model_pipeline
)
from core.evaluator import (
    evaluate_classification_model,
    evaluate_regression_model,
    build_comparison_table,
    get_best_model_summary
)
from core.report_generator import (
    generate_html_report,
    generate_json_report,
    generate_markdown_report,
    export_model_pipeline_bytes
)


def test_end_to_end_classification_workflow():
    # 1. Load Dataset
    df, meta = load_curated_dataset("iris")
    assert df.shape == (150, 5)

    # 2. Quality Analysis
    quality = analyze_data_quality(df)
    assert quality["overview"]["completeness_score"] == 100.0
    recs = generate_quality_recommendations(quality)
    assert len(recs) > 0

    # 3. Detect Targets & Split
    targets = detect_target_candidates(df)
    target_col = "target"
    assert target_col in targets["classification"]

    feature_cols = [c for c in df.columns if c != target_col]
    X_train, X_test, y_train, y_test = prepare_train_test_split(
        df, feature_cols, target_col, test_size=0.2, problem_type="classification"
    )

    # 4. Train Models
    models_to_test = ["logistic_regression", "random_forest", "decision_tree"]
    trained_pipes = {}
    evaluations = {}

    for m_key in models_to_test:
        pipe, fit_time = train_model_pipeline(
            m_key, "classification", X_train, y_train, scaler_type="standard"
        )
        eval_res = evaluate_classification_model(
            pipe, X_test, y_test, model_display_name=m_key, fit_time=fit_time
        )
        trained_pipes[m_key] = pipe
        evaluations[m_key] = eval_res
        assert eval_res["metrics"]["accuracy"] > 0.80

    # 5. Model Comparison
    comp_df = build_comparison_table(evaluations, problem_type="classification")
    assert len(comp_df) == 3
    best_name, best_metric, best_score = get_best_model_summary(comp_df, "classification")
    assert best_score > 0.80

    # 6. Report Generation
    best_info = {"name": best_name, "metric": best_metric, "score": best_score}
    html = generate_html_report(meta, quality, evaluations, best_info, "classification")
    json_rep = generate_json_report(meta, quality, evaluations, best_info, "classification")
    md_rep = generate_markdown_report(meta, quality, evaluations, best_info, "classification")

    assert "OpenDataLens" in html
    assert "iris" in json_rep
    assert best_name in md_rep

    # 7. Model Export
    champion_pipe = trained_pipes[models_to_test[0]]
    export_bytes = export_model_pipeline_bytes(champion_pipe, {"name": best_name})
    assert len(export_bytes) > 0

    # Verify Deserialization
    loaded = joblib.load(io.BytesIO(export_bytes))
    loaded_pipe = loaded["pipeline"]
    test_preds = loaded_pipe.predict(X_test)
    assert len(test_preds) == len(X_test)


def test_end_to_end_regression_workflow():
    # 1. Load Dataset
    df, meta = load_curated_dataset("diabetes")
    assert df.shape[0] == 442

    # 2. Quality Analysis
    quality = analyze_data_quality(df)
    assert quality["overview"]["total_rows"] == 442

    # 3. Detect Targets & Split
    target_col = "target"
    feature_cols = [c for c in df.columns if c != target_col]
    X_train, X_test, y_train, y_test = prepare_train_test_split(
        df, feature_cols, target_col, test_size=0.25, problem_type="regression"
    )

    # 4. Train Models
    models_to_test = ["ridge_regression", "random_forest", "linear_regression"]
    trained_pipes = {}
    evaluations = {}

    for m_key in models_to_test:
        pipe, fit_time = train_model_pipeline(
            m_key, "regression", X_train, y_train, scaler_type="robust"
        )
        eval_res = evaluate_regression_model(
            pipe, X_test, y_test, model_display_name=m_key, fit_time=fit_time
        )
        trained_pipes[m_key] = pipe
        evaluations[m_key] = eval_res
        assert "r2" in eval_res["metrics"]
        assert "rmse" in eval_res["metrics"]

    # 5. Model Comparison
    comp_df = build_comparison_table(evaluations, problem_type="regression")
    assert len(comp_df) == 3
    best_name, best_metric, best_score = get_best_model_summary(comp_df, "regression")
    assert best_metric == "R² Score"

    # 6. Report Generation
    best_info = {"name": best_name, "metric": best_metric, "score": best_score}
    html = generate_html_report(meta, quality, evaluations, best_info, "regression")
    assert "OpenDataLens" in html
