"""
Machine Learning Studio Engine for OpenDataLens
Provides:
- Intelligent Target Candidate Discovery
- Leak-Free Scikit-Learn Preprocessing (Imputation + Scaling + OneHotEncoding)
- Stratified & Shuffled Splitting
- Baseline Model Training for Classification & Regression
"""

import time
from typing import Dict, List, Tuple, Any, Optional
import pandas as pd
import numpy as np

from sklearn.model_selection import train_test_split, StratifiedKFold, KFold
from sklearn.metrics import accuracy_score, r2_score
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import (
    StandardScaler,
    RobustScaler,
    MinMaxScaler,
    OneHotEncoder
)

# Classification Estimators
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import (
    RandomForestClassifier,
    GradientBoostingClassifier
)
from sklearn.tree import DecisionTreeClassifier
from sklearn.neighbors import KNeighborsClassifier
from sklearn.svm import SVC

# Regression Estimators
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.ensemble import (
    RandomForestRegressor,
    GradientBoostingRegressor
)
from sklearn.tree import DecisionTreeRegressor
from sklearn.neighbors import KNeighborsRegressor

from core.config import (
    CLASSIFICATION_MODELS,
    REGRESSION_MODELS
)


def detect_target_candidates(df: pd.DataFrame) -> Dict[str, List[str]]:
    """
    Scan dataframe columns and suggest suitable target columns for
    Classification and Regression tasks.
    """
    classification_candidates = []
    regression_candidates = []

    n_rows = len(df)
    for col in df.columns:
        series = df[col].dropna()
        n_unique = series.nunique()

        # Discard constant columns
        if n_unique <= 1:
            continue

        name_lower = col.lower()
        has_id_keyword = any(kw in name_lower for kw in ["id", "uuid", "guid", "key", "index", "code"])
        has_target_keyword = any(kw in name_lower for kw in [
            "target", "label", "class", "survived", "outcome", "price", "quality", "churn", "medhouseval"
        ])

        # Skip obvious ID column
        if n_unique == n_rows and has_id_keyword and not has_target_keyword:
            continue

        # Classification candidate: categorical, boolean, or low unique count
        if (
            pd.api.types.is_bool_dtype(series) or
            pd.api.types.is_object_dtype(series) or
            isinstance(series.dtype, pd.CategoricalDtype) or
            (pd.api.types.is_integer_dtype(series) and 2 <= n_unique <= 20)
        ):
            if has_target_keyword:
                classification_candidates.insert(0, col)
            else:
                classification_candidates.append(col)

        # Regression candidate: continuous numerical features with diversity
        elif pd.api.types.is_numeric_dtype(series) and n_unique > 5:
            if has_target_keyword:
                regression_candidates.insert(0, col)
            else:
                regression_candidates.append(col)

    return {
        "classification": classification_candidates,
        "regression": regression_candidates
    }


def prepare_train_test_split(
    df: pd.DataFrame,
    feature_cols: List[str],
    target_col: str,
    test_size: float = 0.2,
    random_state: int = 42,
    problem_type: str = "classification"
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.Series, pd.Series]:
    """
    Safely filter missing target values and split into training and testing sets.
    Applies stratified sampling for classification when class sample sizes permit.
    """
    if target_col not in df.columns:
        raise ValueError(f"Target column '{target_col}' not found in dataframe.")

    # Drop samples where target label itself is missing
    clean_df = df.dropna(subset=[target_col]).copy()
    if len(clean_df) < 10:
        raise ValueError("Insufficient data rows (< 10) after dropping missing targets.")

    missing_features = [col for col in feature_cols if col not in df.columns]
    if missing_features:
        raise ValueError(f"Feature columns missing from dataframe: {missing_features}")

    X = clean_df[feature_cols].copy()
    y = clean_df[target_col].copy()

    # Stratified split condition for classification
    stratify = None
    if problem_type == "classification":
        val_counts = y.value_counts()
        # Stratify only if each class has at least 2 samples
        if (val_counts >= 2).all() and len(val_counts) > 1:
            stratify = y

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=test_size,
        random_state=random_state,
        stratify=stratify,
        shuffle=True
    )

    return X_train, X_test, y_train, y_test


def build_preprocessor(
    X_train: pd.DataFrame,
    scaler_type: str = "standard"
) -> ColumnTransformer:
    """
    Build a leak-free ColumnTransformer pipeline.
    - Numerical: Median imputation + Scaler
    - Categorical: Most frequent imputation + OneHotEncoder with handle_unknown='ignore'
    """
    num_cols = X_train.select_dtypes(include=[np.number]).columns.tolist()
    cat_cols = [c for c in X_train.columns if c not in num_cols]

    # Select numerical scaler
    if scaler_type == "robust":
        scaler = RobustScaler()
    elif scaler_type == "minmax":
        scaler = MinMaxScaler()
    else:
        scaler = StandardScaler()

    transformers = []

    if num_cols:
        num_pipeline = Pipeline([
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", scaler)
        ])
        transformers.append(("num", num_pipeline, num_cols))

    if cat_cols:
        cat_pipeline = Pipeline([
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("encoder", OneHotEncoder(handle_unknown="ignore", sparse_output=False))
        ])
        transformers.append(("cat", cat_pipeline, cat_cols))

    if not transformers:
        raise ValueError("No valid numerical or categorical features provided for preprocessing.")

    return ColumnTransformer(transformers=transformers, remainder="drop")


def get_model_estimator(
    model_name: str,
    problem_type: str,
    random_state: int = 42
):
    """Instantiate the designated Scikit-learn estimator."""
    if problem_type == "classification":
        if model_name == "logistic_regression":
            return LogisticRegression(max_iter=1000, random_state=random_state)
        elif model_name == "random_forest":
            return RandomForestClassifier(n_estimators=100, random_state=random_state)
        elif model_name == "gradient_boosting":
            return GradientBoostingClassifier(n_estimators=100, random_state=random_state)
        elif model_name == "decision_tree":
            return DecisionTreeClassifier(max_depth=10, random_state=random_state)
        elif model_name == "k_nearest_neighbors":
            return KNeighborsClassifier(n_neighbors=5)
        elif model_name == "support_vector_machine":
            return SVC(probability=True, random_state=random_state)
        else:
            raise ValueError(f"Unknown classification model: '{model_name}'. Available: {list(CLASSIFICATION_MODELS.keys())}")
    else:
        if model_name == "ridge_regression":
            return Ridge(random_state=random_state)
        elif model_name == "linear_regression":
            return LinearRegression()
        elif model_name == "random_forest":
            return RandomForestRegressor(n_estimators=100, random_state=random_state)
        elif model_name == "gradient_boosting":
            return GradientBoostingRegressor(n_estimators=100, random_state=random_state)
        elif model_name == "decision_tree":
            return DecisionTreeRegressor(max_depth=10, random_state=random_state)
        elif model_name == "k_nearest_neighbors":
            return KNeighborsRegressor(n_neighbors=5)
        else:
            raise ValueError(f"Unknown regression model: '{model_name}'. Available: {list(REGRESSION_MODELS.keys())}")


def train_model_pipeline(
    model_name: str,
    problem_type: str,
    X_train: pd.DataFrame,
    y_train: pd.Series,
    scaler_type: str = "standard",
    random_state: int = 42
) -> Tuple[Pipeline, float]:
    """
    Construct and fit an end-to-end Pipeline ensuring strict zero data leakage.
    Pipeline = Preprocessor (fitted strictly on X_train) -> Estimator
    Returns the fitted pipeline and elapsed training time in seconds.
    """
    preprocessor = build_preprocessor(X_train, scaler_type=scaler_type)
    estimator = get_model_estimator(model_name, problem_type=problem_type, random_state=random_state)

    full_pipeline = Pipeline([
        ("preprocessor", preprocessor),
        ("estimator", estimator)
    ])

    start_time = time.perf_counter()
    full_pipeline.fit(X_train, y_train)
    fit_time = round(time.perf_counter() - start_time, 4)

    return full_pipeline, fit_time


def run_kfold_cross_validation(
    model_name: str,
    problem_type: str,
    X_train: pd.DataFrame,
    y_train: pd.Series,
    scaler_type: str = "standard",
    cv_folds: int = 5,
    random_state: int = 42
) -> Dict[str, Any]:
    """
    Execute leak-free K-Fold or Stratified K-Fold cross validation.
    The preprocessor is fitted strictly on each training fold and only transforms the validation fold.
    """
    if len(X_train) < cv_folds * 2:
        cv_folds = max(2, len(X_train) // 2)

    if problem_type == "classification":
        val_counts = y_train.value_counts()
        if (val_counts >= cv_folds).all() and len(val_counts) > 1:
            splitter = StratifiedKFold(n_splits=cv_folds, shuffle=True, random_state=random_state)
            splits = list(splitter.split(X_train, y_train))
        else:
            splitter = KFold(n_splits=cv_folds, shuffle=True, random_state=random_state)
            splits = list(splitter.split(X_train))
    else:
        splitter = KFold(n_splits=cv_folds, shuffle=True, random_state=random_state)
        splits = list(splitter.split(X_train))

    scores = []
    for train_idx, val_idx in splits:
        X_tr, X_val = X_train.iloc[train_idx], X_train.iloc[val_idx]
        y_tr, y_val = y_train.iloc[train_idx], y_train.iloc[val_idx]

        pipe, _ = train_model_pipeline(
            model_name=model_name,
            problem_type=problem_type,
            X_train=X_tr,
            y_train=y_tr,
            scaler_type=scaler_type,
            random_state=random_state
        )
        preds = pipe.predict(X_val)

        if problem_type == "classification":
            score = float(accuracy_score(y_val, preds))
        else:
            score = float(r2_score(y_val, preds))
        scores.append(round(score, 4))

    return {
        "folds": scores,
        "mean": float(round(np.mean(scores), 4)),
        "std": float(round(np.std(scores), 4)),
        "metric": "Accuracy" if problem_type == "classification" else "R² Score",
        "num_folds": len(scores)
    }

