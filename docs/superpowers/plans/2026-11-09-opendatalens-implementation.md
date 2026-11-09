# OpenDataLens — AI-Powered Dataset Explorer & Model Evaluation Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-ready, portfolio-grade web application in Streamlit and Python that empowers users to explore datasets (from Hugging Face and CSV uploads), analyze data quality, train and compare ML models with leak-free preprocessing, and generate downloadable evaluation reports.

**Architecture:** Modular architecture separating UI components, core ML and quality analytics engines, dataset connectors (HF API + local CSV), Plotly visualizations, and report generation into clean, testable Python packages with stateful Streamlit orchestration.

**Tech Stack:** Python 3.13, Streamlit, Pandas, NumPy, Scikit-learn, Plotly, Matplotlib, Joblib, Requests, Hugging Face Datasets/Hub API.

**Spec:** MASTER PROJECT PROMPT — OpenDataLens

## Global Constraints
- Clean, modular Python structure under `OpenDataLens/` with `core/`, `ui/`, `tests/`.
- Strict data leakage prevention: Preprocessing transformations must be fitted solely on training splits.
- Design System: UI/UX Pro Max Data-Dense Dashboard (#1E40AF primary, #3B82F6 secondary, #D97706 accent, #F8FAFC background).
- Robust error handling: Graceful recovery for invalid CSV files, empty columns, corrupted HF responses, and edge cases.
- Comprehensive test coverage with passing unit tests for every core module.

## Review Focus
1. Data leakage during preprocessing: Ensure ColumnTransformer is never fit on testing data.
2. High cardinality or single-value columns: Handled gracefully without crashing encoders or model training.
3. Class imbalance or single-class targets: Detected and communicated clearly to the user before training.
4. Large Hugging Face datasets: Safely capped or previewed using HF Dataset Viewer API without out-of-memory crashes.
5. Missing values in test sets: Properly imputed using statistics learned from the training set.

---

### Task 1: Project Environment & Scaffolding
**Files:**
- Create: `requirements.txt`
- Create: `.gitignore`
- Create: `core/__init__.py`
- Create: `core/config.py`
- Create: `tests/__init__.py`

- [ ] **Step 1: Create project directory and requirements.txt**
- [ ] **Step 2: Initialize git repository and .gitignore**
- [ ] **Step 3: Define application configuration in core/config.py**
- [ ] **Step 4: Verify environment and package imports**

---

### Task 2: Dataset Loader Module (Hugging Face & CSV)
**Files:**
- Create: `core/dataset_loader.py`
- Create: `tests/test_dataset_loader.py`

**Interfaces:**
- Produces: `search_hf_datasets(query: str, limit: int) -> List[Dict]`
- Produces: `load_hf_dataset(dataset_name: str, split: str, max_rows: int) -> Tuple[pd.DataFrame, Dict]`
- Produces: `load_csv_dataset(file_or_bytes, **kwargs) -> Tuple[pd.DataFrame, Dict]`
- Produces: `get_sample_datasets() -> Dict[str, pd.DataFrame]`

- [ ] **Step 1: Write unit tests in tests/test_dataset_loader.py**
- [ ] **Step 2: Implement dataset_loader.py with HF API integration and safe CSV ingestion**
- [ ] **Step 3: Run pytest on test_dataset_loader.py**

---

### Task 3: Data Quality Analysis Engine
**Files:**
- Create: `core/quality_analyzer.py`
- Create: `tests/test_quality_analyzer.py`

**Interfaces:**
- Consumes: `pd.DataFrame`
- Produces: `analyze_data_quality(df: pd.DataFrame) -> Dict[str, Any]`
- Produces: `generate_quality_recommendations(analysis: Dict[str, Any]) -> List[Dict[str, str]]`

- [ ] **Step 1: Write unit tests for missing values, duplicates, datatypes, and stats**
- [ ] **Step 2: Implement quality_analyzer.py**
- [ ] **Step 3: Run pytest on test_quality_analyzer.py**

---

### Task 4: Visualizer Module (Plotly Interactive Charts)
**Files:**
- Create: `core/visualizer.py`
- Create: `tests/test_visualizer.py`

**Interfaces:**
- Produces: `plot_missing_matrix(df: pd.DataFrame) -> go.Figure`
- Produces: `plot_feature_distributions(df: pd.DataFrame, col: str) -> go.Figure`
- Produces: `plot_correlation_heatmap(df: pd.DataFrame) -> go.Figure`
- Produces: `plot_confusion_matrix(cm, labels) -> go.Figure`
- Produces: `plot_residuals(y_true, y_pred) -> go.Figure`
- Produces: `plot_model_comparison(comparison_df: pd.DataFrame, metric: str) -> go.Figure`

- [ ] **Step 1: Write tests for figure creation**
- [ ] **Step 2: Implement visualizer.py using Plotly with custom UI/UX Pro Max styling**
- [ ] **Step 3: Verify figure outputs**

---

### Task 5: ML Studio Engine (Leak-Free Preprocessing & Training)
**Files:**
- Create: `core/ml_studio.py`
- Create: `tests/test_ml_studio.py`

**Interfaces:**
- Produces: `detect_target_candidates(df: pd.DataFrame) -> Dict[str, List[str]]`
- Produces: `build_preprocessor(df: pd.DataFrame, feature_cols: List[str], target_col: str) -> ColumnTransformer`
- Produces: `train_models(X_train, y_train, problem_type: str, selected_models: List[str]) -> Dict[str, Any]`

- [ ] **Step 1: Write unit tests for classification and regression pipelines**
- [ ] **Step 2: Implement ml_studio.py with Scikit-learn Pipelines**
- [ ] **Step 3: Run pytest on test_ml_studio.py**

---

### Task 6: Model Evaluator & Comparison Studio
**Files:**
- Create: `core/evaluator.py`
- Create: `tests/test_evaluator.py`

**Interfaces:**
- Produces: `evaluate_model(pipeline, X_test, y_test, problem_type: str) -> Dict[str, Any]`
- Produces: `compare_models(evaluated_models: Dict[str, Dict]) -> pd.DataFrame`
- Produces: `get_best_model(comparison_df: pd.DataFrame, problem_type: str) -> Tuple[str, float]`

- [ ] **Step 1: Write unit tests for evaluation metrics (Acc, F1, Precision, Recall, MAE, RMSE, R²)**
- [ ] **Step 2: Implement evaluator.py**
- [ ] **Step 3: Run pytest on test_evaluator.py**

---

### Task 7: Report Generator & Model Artifact Export
**Files:**
- Create: `core/report_generator.py`
- Create: `tests/test_report_generator.py`

**Interfaces:**
- Produces: `generate_html_report(dataset_meta, quality_analysis, evaluation_results, best_model_info) -> str`
- Produces: `generate_json_report(...) -> str`
- Produces: `export_model_pipeline(pipeline, metadata) -> bytes`

- [ ] **Step 1: Write unit tests for report generation**
- [ ] **Step 2: Implement report_generator.py**
- [ ] **Step 3: Run pytest on test_report_generator.py**

---

### Task 8: Streamlit UI Implementation (Pages & Components)
**Files:**
- Create: `ui/__init__.py`
- Create: `ui/styles.py` (UI/UX Pro Max CSS design system)
- Create: `ui/components.py` (KPI cards, alerts, badges, empty states)
- Create: `ui/page_dataset_explorer.py`
- Create: `ui/page_data_quality.py`
- Create: `ui/page_ml_studio.py`
- Create: `ui/page_model_comparison.py`
- Create: `ui/page_report_export.py`
- Create: `app.py` (Main controller)

- [ ] **Step 1: Implement styles.py and components.py**
- [ ] **Step 2: Implement pages with seamless session state binding**
- [ ] **Step 3: Implement main app.py navigation and header**

---

### Task 9: End-to-End Testing & Browser Verification
- [ ] **Step 1: Run complete automated test suite**
- [ ] **Step 2: Test edge cases (invalid CSV, single class, missing values, extreme dimensions)**
- [ ] **Step 3: Run Streamlit application and verify interactive workflows**

---

### Task 10: GitHub Documentation & Portfolio Packaging
**Files:**
- Create: `README.md`
- Create: `LICENSE`
- Verify git status and clean structure
