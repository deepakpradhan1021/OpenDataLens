"""
OpenDataLens - Configuration and Design System Constants
Adhering to UI/UX Pro Max Enterprise Data-Dense Dashboard Guidelines.
"""

from dataclasses import dataclass
from typing import Dict, List, Any


# Application Branding
APP_NAME = "OpenDataLens"
APP_TAGLINE = "AI-Powered Dataset Explorer & Model Evaluation Platform"
APP_VERSION = "1.0.0"

# UI/UX Pro Max Design System Tokens (Enterprise Data-Dense Dashboard)
THEME_COLORS = {
    "primary": "#1E40AF",          # Deep Tech Navy
    "primary_dark": "#1E3A8A",
    "primary_light": "#3B82F6",    # Bright Tech Blue
    "secondary": "#6366F1",        # Indigo
    "accent": "#D97706",           # Amber Warm Highlight
    "accent_hover": "#B45309",
    "background": "#F8FAFC",       # Slate 50 Neutral Canvas
    "surface": "#FFFFFF",          # Pure White Cards
    "surface_secondary": "#F1F5F9",
    "text_primary": "#0F172A",     # Slate 900
    "text_secondary": "#475569",   # Slate 600
    "text_muted": "#94A3B8",       # Slate 400
    "border": "#E2E8F0",           # Slate 200
    "border_subtle": "#CBD5E1",
    "success": "#10B981",          # Emerald
    "success_bg": "#ECFDF5",
    "warning": "#F59E0B",          # Amber
    "warning_bg": "#FFFBEB",
    "danger": "#EF4444",           # Rose
    "danger_bg": "#FEF2F2",
    "info": "#0284C7",             # Sky Blue
    "info_bg": "#F0F9FF"
}

# Hugging Face Endpoints
HF_API_BASE_URL = "https://huggingface.co/api/datasets"
HF_DATASET_VIEWER_BASE_URL = "https://datasets-server.huggingface.co"

# Curated Popular Datasets for Instant Exploration
CURATED_DATASETS = [
    {
        "id": "iris",
        "name": "Iris Flower Dataset",
        "description": "50 samples from each of three species of Iris flowers (setosa, virginica, versicolor) with 4 physical measurements.",
        "task": "classification",
        "rows": 150,
        "cols": 5,
        "target": "target",
        "source": "scikit-learn"
    },
    {
        "id": "wine_quality",
        "name": "Wine Quality (Red)",
        "description": "Physicochemical tests of red wine variants with target quality score rating between 0 and 10.",
        "task": "classification",
        "rows": 1599,
        "cols": 12,
        "target": "quality",
        "source": "scikit-learn"
    },
    {
        "id": "california_housing",
        "name": "California Housing Prices",
        "description": "Median house values for California districts derived from the 1990 U.S. census for regression benchmarking.",
        "task": "regression",
        "rows": 20640,
        "cols": 9,
        "target": "MedHouseVal",
        "source": "scikit-learn"
    },
    {
        "id": "breast_cancer",
        "name": "Breast Cancer Wisconsin",
        "description": "Diagnostic dataset with 30 features computed from digitized images of fine needle aspirates of breast masses.",
        "task": "classification",
        "rows": 569,
        "cols": 31,
        "target": "target",
        "source": "scikit-learn"
    },
    {
        "id": "diabetes",
        "name": "Diabetes Progression",
        "description": "Ten baseline variables, age, sex, BMI, average blood pressure, and six blood serum measurements with quantitative disease progression.",
        "task": "regression",
        "rows": 442,
        "cols": 11,
        "target": "target",
        "source": "scikit-learn"
    },
    {
        "id": "titanic_sample",
        "name": "Titanic Passenger Survival",
        "description": "Passenger demographics and survival status featuring mixed data types, missing values, and categorical features.",
        "task": "classification",
        "rows": 891,
        "cols": 12,
        "target": "Survived",
        "source": "embedded"
    }
]

# Supported ML Models
CLASSIFICATION_MODELS = {
    "logistic_regression": "Logistic Regression",
    "random_forest": "Random Forest Classifier",
    "gradient_boosting": "Gradient Boosting Classifier",
    "decision_tree": "Decision Tree Classifier",
    "k_nearest_neighbors": "K-Nearest Neighbors",
    "support_vector_machine": "Support Vector Classifier (Linear/RBF)"
}

REGRESSION_MODELS = {
    "ridge_regression": "Ridge Regression",
    "linear_regression": "Linear Regression",
    "random_forest": "Random Forest Regressor",
    "gradient_boosting": "Gradient Boosting Regressor",
    "decision_tree": "Decision Tree Regressor",
    "k_nearest_neighbors": "K-Nearest Neighbors Regressor"
}

# Evaluation Metric Rules
CLASSIFICATION_METRICS = [
    "accuracy", "precision_macro", "recall_macro", "f1_macro", "f1_weighted"
]

REGRESSION_METRICS = [
    "r2", "mae", "mse", "rmse", "explained_variance"
]
