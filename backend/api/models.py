"""
Pydantic Request and Response Schemas for OpenDataLens API.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


# Health Check
class HealthResponse(BaseModel):
    status: str = "operational"
    version: str = "1.0.0"
    platform: str = "OpenDataLens SaaS"
    timestamp: Optional[str] = None
    uptime_seconds: Optional[float] = None
    active_sessions: Optional[int] = None
    memory_rss_mb: Optional[float] = None
    memory_status: Optional[str] = None
    requests_total: Optional[int] = None
    active_jobs: Optional[int] = None


# Dataset Schemas
class CuratedDatasetItem(BaseModel):
    id: str
    name: str
    description: str
    task: str
    rows: int
    cols: int
    target: Optional[str] = None
    source: str = "scikit-learn"


class LoadCuratedRequest(BaseModel):
    dataset_id: str
    session_id: str = "default"


class LoadHFRequest(BaseModel):
    dataset_name: str
    split: str = "train"
    max_rows: int = 2000
    session_id: str = "default"


class HFDatasetCard(BaseModel):
    id: str
    name: str
    author: str
    description: str
    downloads: int = 0
    likes: int = 0
    tags: List[str] = []
    private: bool = False


class ColumnSchemaInfo(BaseModel):
    name: str
    dtype: str
    non_null_count: int
    null_count: int
    unique_count: int
    sample_value: Optional[str] = None


class DatasetPreviewResponse(BaseModel):
    session_id: str
    metadata: Dict[str, Any]
    total_rows: int
    total_cols: int
    memory_mb: float
    columns: List[ColumnSchemaInfo]
    records: List[Dict[str, Any]]


# Quality Schemas
class QualityOverview(BaseModel):
    total_rows: int
    total_cols: int
    total_cells: int
    total_missing_cells: int
    completeness_score: float
    duplicate_rows: int
    duplicate_pct: float
    memory_mb: float


class QualityRecommendation(BaseModel):
    type: str  # warning, danger, info, success
    title: str
    description: str
    action: Optional[str] = None
    columns: List[str] = []


class QualityAnalysisResponse(BaseModel):
    overview: QualityOverview
    missing_summary: Dict[str, Any]
    column_types: Dict[str, List[str]]
    numeric_stats: Dict[str, Any]
    categorical_stats: Dict[str, Any]
    recommendations: List[QualityRecommendation]
    correlation_matrix: Optional[Dict[str, Any]] = None


# ML Studio Schemas
class TargetCandidatesResponse(BaseModel):
    classification: List[str]
    regression: List[str]
    suggested_task: str
    columns: List[str]


class TrainModelsRequest(BaseModel):
    session_id: str = "default"
    problem_type: str  # "classification" | "regression"
    target_col: str
    feature_cols: List[str]
    selected_models: List[str]
    scaler_type: str = "standard"  # "standard" | "robust" | "minmax"
    test_size: float = Field(default=0.2, ge=0.05, le=0.5)
    random_state: int = 42
    cv_folds: int = Field(default=5, ge=2, le=10)


class TrainJobStartResponse(BaseModel):
    job_id: str
    status: str = "running"
    total_models: int
    message: str


class JobStatusResponse(BaseModel):
    job_id: str
    status: str  # pending, running, completed, failed
    progress: int  # 0 to 100
    current_model: str
    error: Optional[str] = None
    completed_at: Optional[float] = None


# Evaluation Schemas
class ChampionModelInfo(BaseModel):
    name: str
    metric: str
    score: float


class ModelEvaluationSummary(BaseModel):
    model_name: str
    problem_type: str
    fit_time: float
    metrics: Dict[str, float]


class ModelComparisonResponse(BaseModel):
    problem_type: str
    champion: ChampionModelInfo
    scoreboard: List[Dict[str, Any]]
    available_models: List[str]


class ModelDiagnosticsResponse(BaseModel):
    model_name: str
    problem_type: str
    fit_time: float
    metrics: Dict[str, float]
    confusion_matrix: Optional[List[List[int]]] = None
    class_labels: Optional[List[str]] = None
    classification_report: Optional[Dict[str, Any]] = None
    residuals: Optional[List[float]] = None
    predictions: Optional[List[float]] = None
    ground_truth: Optional[List[float]] = None


# Data Cleaning & Undo/Redo Schemas
class CleanActionRequest(BaseModel):
    session_id: str = "default"
    action_type: str  # impute_missing, remove_duplicates, convert_dtype, rename_column, drop_columns, clip_outliers, filter_rows
    params: Dict[str, Any] = {}


class CleanActionResponse(BaseModel):
    status: str = "success"
    action: str
    rows: int
    cols: int
    can_undo: bool
    can_redo: bool
    preview: DatasetPreviewResponse


class UndoRedoRequest(BaseModel):
    session_id: str = "default"


class HistoryItem(BaseModel):
    step: int
    action: str
    timestamp: float
    rows: int
    cols: int


class HistoryResponse(BaseModel):
    history: List[HistoryItem]
    can_undo: bool
    can_redo: bool
    last_action: Optional[str] = None


class PreviewCleanRequest(BaseModel):
    session_id: str = "default"
    action_type: str
    params: Dict[str, Any] = {}


class PreviewCleanResponse(BaseModel):
    status: str = "preview"
    action_type: str
    summary: str
    rows_before: int
    rows_after: int
    cols_before: int
    cols_after: int
    affected_column: Optional[str] = None
    sample_before: List[Dict[str, Any]] = []
    sample_after: List[Dict[str, Any]] = []
    stats_before: Optional[Dict[str, Any]] = None
    stats_after: Optional[Dict[str, Any]] = None


class NamedCheckpointCreateRequest(BaseModel):
    session_id: str = "default"
    name: str


class NamedCheckpointRestoreRequest(BaseModel):
    session_id: str = "default"
    name: str


class NamedCheckpointItem(BaseModel):
    name: str
    timestamp: float
    rows: int
    cols: int
    last_action: Optional[str] = None


class NamedCheckpointsResponse(BaseModel):
    checkpoints: List[NamedCheckpointItem]
    count: int


# Visualization Engine Schemas
class ChartDataRequest(BaseModel):
    session_id: str = "default"
    chart_type: str = "bar"
    x_col: str
    y_col: Optional[str] = None
    aggregation: str = "mean"
    bins: int = 10
    bin_numeric: bool = True
    sort_by: str = "auto"
    top_n: int = 15
    filter_min: Optional[float] = None
    filter_max: Optional[float] = None
    exclude_nulls: bool = True


class ChartDataResponse(BaseModel):
    chart_type: str
    x_col: Optional[str] = None
    y_col: Optional[str] = None
    data: Any
    insights: Dict[str, Any]
    total_rows: int
    valid_rows: Optional[int] = None

