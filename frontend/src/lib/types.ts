export interface CuratedDatasetItem {
  id: string;
  name: string;
  description: string;
  task: string;
  rows: number;
  cols: number;
  target?: string;
  source: string;
}

export interface HFDatasetCard {
  id: string;
  name: string;
  author: string;
  description: string;
  downloads: number;
  likes: number;
  tags: string[];
  private: boolean;
}

export interface ColumnSchemaInfo {
  name: string;
  dtype: string;
  non_null_count: number;
  null_count: number;
  unique_count: number;
  sample_value?: string;
}

export interface DatasetPreviewResponse {
  session_id: string;
  metadata: {
    id: string;
    name: string;
    description?: string;
    task?: string;
    suggested_target?: string;
    source?: string;
    [key: string]: any;
  };
  total_rows: number;
  total_cols: number;
  memory_mb: number;
  columns: ColumnSchemaInfo[];
  records: Record<string, any>[];
}

export interface QualityOverview {
  total_rows: number;
  total_cols: number;
  total_cells: number;
  total_missing_cells: number;
  completeness_score: number;
  duplicate_rows: number;
  duplicate_pct: number;
  memory_mb: number;
}

export interface QualityRecommendation {
  type: "warning" | "danger" | "info" | "success";
  title: string;
  description: string;
  action?: string;
  columns: string[];
}

export interface QualityAnalysisResponse {
  overview: QualityOverview;
  missing_summary: Record<string, {
    missing_count: number;
    missing_pct: number;
    dtype: string;
    present_count: number;
  }>;
  column_types: {
    numeric: string[];
    categorical: string[];
    text: string[];
    datetime: string[];
    constant: string[];
    id_candidate: string[];
  };
  numeric_stats: Record<string, any>;
  categorical_stats: Record<string, any>;
  recommendations: QualityRecommendation[];
  correlation_matrix?: {
    columns: string[];
    values: (number | null)[][];
  };
}

export interface TargetCandidatesResponse {
  classification: string[];
  regression: string[];
  suggested_task: string;
  columns: string[];
}

export interface TrainModelsRequest {
  session_id?: string;
  problem_type: "classification" | "regression";
  target_col: string;
  feature_cols: string[];
  selected_models: string[];
  scaler_type: "standard" | "robust" | "minmax";
  test_size: number;
  random_state?: number;
}

export interface TrainJobStartResponse {
  job_id: string;
  status: string;
  total_models: number;
  message: string;
}

export interface JobStatusResponse {
  job_id: string;
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
  current_model: string;
  error?: string;
  completed_at?: number;
  completed_models?: string[];
  total_models?: number;
}

export interface ChampionModelInfo {
  name: string;
  metric: string;
  score: number;
}

export interface ModelComparisonResponse {
  problem_type: string;
  champion: ChampionModelInfo;
  scoreboard: Record<string, any>[];
  available_models: string[];
}

export interface ModelDiagnosticsResponse {
  model_name: string;
  problem_type: string;
  fit_time: number;
  metrics: Record<string, number>;
  confusion_matrix?: number[][];
  class_labels?: string[];
  classification_report?: Record<string, any>;
  residuals?: number[];
  predictions?: number[];
  ground_truth?: number[];
}
