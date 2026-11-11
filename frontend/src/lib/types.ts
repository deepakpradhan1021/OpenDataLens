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
    is_synthetic?: boolean;
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
  outliers?: Record<string, {
    outlier_count: number;
    outlier_pct: number;
    lower_bound: number;
    upper_bound: number;
  }>;
  high_cardinality?: Record<string, {
    unique_count: number;
    uniqueness_ratio: number;
    risk: string;
  }>;
  high_correlation_pairs?: Array<{
    feature_1: string;
    feature_2: string;
    correlation: number;
    is_leakage_risk: boolean;
    severity: string;
  }>;
  correlation_matrix?: {
    columns: string[];
    values: (number | null)[][];
  };
}

export interface NumericDistributionBin {
  bin: string;
  min: number;
  max: number;
  count: number;
}

export interface CategoricalDistributionItem {
  category: string;
  count: number;
}

export interface ColumnDistributionResponse {
  type: "numeric" | "categorical" | "empty";
  column: string;
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
  bins?: NumericDistributionBin[];
  unique?: number;
  categories?: CategoricalDistributionItem[];
  data?: any[];
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
  cv_folds?: number;
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

export interface FeatureImportanceItem {
  feature: string;
  importance_mean?: number;
  importance?: number;
  importance_std?: number;
  relative_pct: number;
}

export interface ExplainabilityResponse {
  model_key: string;
  model_name: string;
  problem_type: string;
  primary_metric: string;
  top_drivers: string[];
  summary: string;
  permutation_importance: FeatureImportanceItem[];
  native_importance?: FeatureImportanceItem[] | null;
  has_native_importance: boolean;
  available_models: string[];
}

export interface DriftFeatureMetric {
  feature: string;
  type: "numeric" | "categorical";
  psi: number;
  ks_statistic?: number;
  ks_p_value?: number;
  tvd?: number;
  top_shifted_category?: string;
  status: "stable" | "warning" | "drifted" | "insufficient_data";
  recommendation: string;
  reference_stats?: Record<string, any>;
  target_stats?: Record<string, any>;
}

export interface DriftAnalysisResponse {
  overall_status: "stable" | "moderate_drift" | "significant_drift" | "insufficient_data";
  badge_label: string;
  summary: string;
  mean_psi: number;
  drifted_features_count: number;
  warning_features_count: number;
  stable_features_count: number;
  total_features_evaluated: number;
  reference_rows: number;
  target_rows: number;
  schema_changes: {
    removed_columns: string[];
    added_columns: string[];
    common_columns_count: number;
    type_mismatches?: { column: string; reference_dtype: string; target_dtype: string }[];
  };
  missing_value_shifts: Record<string, {
    reference_pct: number;
    target_pct: number;
    diff_pct: number;
  }>;
  features: DriftFeatureMetric[];
}

export interface ExperimentRun {
  run_id: string;
  timestamp: number;
  duration_seconds: number;
  dataset_name: string;
  dataset_rows: number;
  dataset_cols: number;
  problem_type: string;
  target_col: string;
  feature_count: number;
  selected_models: string[];
  cv_folds: number;
  scaler: string;
  champion_model: string;
  scoreboard: Record<string, any>[];
}

export interface CopilotResponse {
  answer: string;
  intent: string;
  suggested_followups: string[];
}
