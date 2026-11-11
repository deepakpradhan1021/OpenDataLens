import axios from "axios";
import {
  CuratedDatasetItem,
  HFDatasetCard,
  DatasetPreviewResponse,
  QualityAnalysisResponse,
  TargetCandidatesResponse,
  TrainModelsRequest,
  TrainJobStartResponse,
  JobStatusResponse,
  ModelComparisonResponse,
  ModelDiagnosticsResponse,
  ExplainabilityResponse,
  DriftAnalysisResponse,
  ExperimentRun,
  CopilotResponse
} from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export function getWorkspaceId(): string {
  if (typeof window === "undefined") {
    return "default";
  }
  let id = localStorage.getItem("opendatalens_workspace_id");
  if (!id || id === "default" || id.length < 8) {
    id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `ws_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem("opendatalens_workspace_id", id);
  }
  return id;
}

export function resetWorkspaceId(): string {
  if (typeof window !== "undefined") {
    const freshId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `ws_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem("opendatalens_workspace_id", freshId);
    return freshId;
  }
  return "default";
}

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

// Automatically inject unique workspace session ID header into every request
apiClient.interceptors.request.use((config) => {
  const currentWorkspaceId = getWorkspaceId();
  config.headers["X-Session-ID"] = currentWorkspaceId;
  return config;
});

export const api = {
  // Health
  getHealth: async () => {
    const { data } = await apiClient.get("/health");
    return data;
  },

  // Datasets
  getCuratedDatasets: async (): Promise<CuratedDatasetItem[]> => {
    const { data } = await apiClient.get("/datasets/curated");
    return data;
  },

  loadCuratedDataset: async (datasetId: string, sessionId?: string): Promise<DatasetPreviewResponse> => {
    const sid = sessionId || getWorkspaceId();
    const { data } = await apiClient.post("/datasets/load-curated", {
      dataset_id: datasetId,
      session_id: sid,
    });
    return data;
  },

  searchHFDatasets: async (query: string = "tabular", limit: number = 9): Promise<HFDatasetCard[]> => {
    const { data } = await apiClient.get("/datasets/search-hf", {
      params: { query, limit },
    });
    return data;
  },

  loadHFDataset: async (
    datasetName: string,
    split: string = "train",
    maxRows: number = 2000,
    sessionId?: string
  ): Promise<DatasetPreviewResponse> => {
    const sid = sessionId || getWorkspaceId();
    const { data } = await apiClient.post("/datasets/load-hf", {
      dataset_name: datasetName,
      split,
      max_rows: maxRows,
      session_id: sid,
    });
    return data;
  },

  uploadCSV: async (file: File, sessionId?: string): Promise<DatasetPreviewResponse> => {
    const sid = sessionId || getWorkspaceId();
    const formData = new FormData();
    formData.append("file", file);
    formData.append("session_id", sid);
    const { data } = await apiClient.post("/datasets/upload-csv", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  getActiveDataset: async (sessionId?: string): Promise<DatasetPreviewResponse> => {
    const sid = sessionId || getWorkspaceId();
    const { data } = await apiClient.get("/datasets/active", {
      params: { session_id: sid },
    });
    return data;
  },

  clearWorkspace: async (): Promise<{ status: string; message: string }> => {
    const sid = getWorkspaceId();
    const { data } = await apiClient.post("/datasets/clear-workspace", null, {
      params: { session_id: sid },
    });
    resetWorkspaceId();
    return data;
  },

  // Quality
  getQualityAnalysis: async (sessionId?: string): Promise<QualityAnalysisResponse> => {
    const sid = sessionId || getWorkspaceId();
    const { data } = await apiClient.get("/quality/analysis", {
      params: { session_id: sid },
    });
    return data;
  },

  getColumnDistribution: async (column: string, sessionId?: string) => {
    const sid = sessionId || getWorkspaceId();
    const { data } = await apiClient.get("/quality/distribution", {
      params: { column, session_id: sid },
    });
    return data;
  },

  // ML Studio
  getTargetCandidates: async (sessionId?: string): Promise<TargetCandidatesResponse> => {
    const sid = sessionId || getWorkspaceId();
    const { data } = await apiClient.get("/ml/target-candidates", {
      params: { session_id: sid },
    });
    return data;
  },

  startTrainingJob: async (req: TrainModelsRequest): Promise<TrainJobStartResponse> => {
    const sid = req.session_id || getWorkspaceId();
    const { data } = await apiClient.post("/ml/train", {
      ...req,
      session_id: sid,
    });
    return data;
  },

  trainModels: async (req: TrainModelsRequest): Promise<TrainJobStartResponse> => {
    const sid = req.session_id || getWorkspaceId();
    const { data } = await apiClient.post("/ml/train", {
      ...req,
      session_id: sid,
    });
    return data;
  },

  getJobStatus: async (jobId: string): Promise<JobStatusResponse> => {
    const { data } = await apiClient.get(`/ml/train/status/${jobId}`);
    return data;
  },

  getExperiments: async (sessionId?: string): Promise<{ total_runs: number; experiments: ExperimentRun[] }> => {
    const sid = sessionId || getWorkspaceId();
    const { data } = await apiClient.get("/ml/experiments", {
      params: { session_id: sid },
    });
    return data;
  },

  exportExperimentsUrl: (sessionId?: string) => {
    const sid = sessionId || getWorkspaceId();
    return `${API_BASE_URL}/ml/experiments/export?session_id=${sid}`;
  },

  // Evaluation & Explainability
  getModelComparison: async (sessionId?: string): Promise<ModelComparisonResponse> => {
    const sid = sessionId || getWorkspaceId();
    const { data } = await apiClient.get("/evaluation/comparison", {
      params: { session_id: sid },
    });
    return data;
  },

  getModelDiagnostics: async (modelKey: string, sessionId?: string): Promise<ModelDiagnosticsResponse> => {
    const sid = sessionId || getWorkspaceId();
    const { data } = await apiClient.get(`/evaluation/diagnostics/${modelKey}`, {
      params: { session_id: sid },
    });
    return data;
  },

  getExplainability: async (modelKey?: string, sessionId?: string): Promise<ExplainabilityResponse> => {
    const sid = sessionId || getWorkspaceId();
    const { data } = await apiClient.get("/evaluation/explainability", {
      params: {
        session_id: sid,
        ...(modelKey ? { model_key: modelKey } : {})
      },
    });
    return data;
  },

  explainSample: async (sampleIndex: number = 0, modelKey?: string, sessionId?: string) => {
    const sid = sessionId || getWorkspaceId();
    const { data } = await apiClient.post("/evaluation/explain-sample", {
      session_id: sid,
      model_key: modelKey,
      sample_index: sampleIndex,
    });
    return data;
  },

  // Data Drift
  getDriftAnalysis: async (splitRatio: number = 0.5, sessionId?: string): Promise<DriftAnalysisResponse> => {
    const sid = sessionId || getWorkspaceId();
    const { data } = await apiClient.get("/drift/analyze", {
      params: { session_id: sid, split_ratio: splitRatio },
    });
    return data;
  },

  compareTargetCSVDrift: async (file: File, sessionId?: string): Promise<DriftAnalysisResponse> => {
    const sid = sessionId || getWorkspaceId();
    const formData = new FormData();
    formData.append("target_file", file);
    formData.append("session_id", sid);
    const { data } = await apiClient.post("/drift/compare-csv", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  // Copilot
  queryCopilot: async (query: string, sessionId?: string): Promise<CopilotResponse> => {
    const sid = sessionId || getWorkspaceId();
    const { data } = await apiClient.post("/copilot/query", {
      query,
      session_id: sid,
    });
    return data;
  },

  // Reports
  downloadHtmlReport: (sessionId?: string) => {
    const sid = sessionId || getWorkspaceId();
    return `${API_BASE_URL}/reports/html?session_id=${sid}`;
  },

  getHtmlReportUrl: (sessionId?: string) => {
    const sid = sessionId || getWorkspaceId();
    return `${API_BASE_URL}/reports/html?session_id=${sid}`;
  },

  downloadJsonReport: (sessionId?: string) => {
    const sid = sessionId || getWorkspaceId();
    return `${API_BASE_URL}/reports/json?session_id=${sid}`;
  },

  getJsonReportUrl: (sessionId?: string) => {
    const sid = sessionId || getWorkspaceId();
    return `${API_BASE_URL}/reports/json?session_id=${sid}`;
  },

  downloadMarkdownReport: (sessionId?: string) => {
    const sid = sessionId || getWorkspaceId();
    return `${API_BASE_URL}/reports/markdown?session_id=${sid}`;
  },

  getMarkdownReportUrl: (sessionId?: string) => {
    const sid = sessionId || getWorkspaceId();
    return `${API_BASE_URL}/reports/markdown?session_id=${sid}`;
  },

  downloadModelPipeline: (modelKey: string, sessionId?: string) => {
    const sid = sessionId || getWorkspaceId();
    return `${API_BASE_URL}/reports/model/${modelKey}?session_id=${sid}`;
  },

  getModelDownloadUrl: (modelKey: string, sessionId?: string) => {
    const sid = sessionId || getWorkspaceId();
    return `${API_BASE_URL}/reports/model/${modelKey}?session_id=${sid}`;
  },

  getDatasetCsvUrl: (sessionId?: string) => {
    const sid = sessionId || getWorkspaceId();
    return `${API_BASE_URL}/reports/dataset-csv?session_id=${sid}`;
  },
};
