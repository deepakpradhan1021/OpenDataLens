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
} from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
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

  loadCuratedDataset: async (datasetId: string, sessionId: string = "default"): Promise<DatasetPreviewResponse> => {
    const { data } = await apiClient.post("/datasets/load-curated", {
      dataset_id: datasetId,
      session_id: sessionId,
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
    sessionId: string = "default"
  ): Promise<DatasetPreviewResponse> => {
    const { data } = await apiClient.post("/datasets/load-hf", {
      dataset_name: datasetName,
      split,
      max_rows: maxRows,
      session_id: sessionId,
    });
    return data;
  },

  uploadCSV: async (file: File, sessionId: string = "default"): Promise<DatasetPreviewResponse> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("session_id", sessionId);
    const { data } = await apiClient.post("/datasets/upload-csv", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  getActiveDataset: async (sessionId: string = "default"): Promise<DatasetPreviewResponse> => {
    const { data } = await apiClient.get("/datasets/active", {
      params: { session_id: sessionId },
    });
    return data;
  },

  // Quality
  getQualityAnalysis: async (sessionId: string = "default"): Promise<QualityAnalysisResponse> => {
    const { data } = await apiClient.get("/quality/analysis", {
      params: { session_id: sessionId },
    });
    return data;
  },

  getColumnDistribution: async (column: string, sessionId: string = "default") => {
    const { data } = await apiClient.get("/quality/distribution", {
      params: { column, session_id: sessionId },
    });
    return data;
  },

  // ML Studio
  getTargetCandidates: async (sessionId: string = "default"): Promise<TargetCandidatesResponse> => {
    const { data } = await apiClient.get("/ml/target-candidates", {
      params: { session_id: sessionId },
    });
    return data;
  },

  startModelTraining: async (payload: TrainModelsRequest): Promise<TrainJobStartResponse> => {
    const { data } = await apiClient.post("/ml/train", payload);
    return data;
  },

  trainModels: async (payload: TrainModelsRequest): Promise<TrainJobStartResponse> => {
    const { data } = await apiClient.post("/ml/train", payload);
    return data;
  },

  downloadModel: async (modelKey: string, sessionId: string = "default"): Promise<Blob> => {
    const response = await apiClient.get(`/reports/model/${encodeURIComponent(modelKey)}`, {
      params: { session_id: sessionId },
      responseType: "blob",
    });
    return response.data;
  },

  getJobStatus: async (jobId: string): Promise<JobStatusResponse> => {
    const { data } = await apiClient.get(`/ml/train/status/${jobId}`);
    return data;
  },

  // Evaluation
  getModelComparison: async (sessionId: string = "default"): Promise<ModelComparisonResponse> => {
    const { data } = await apiClient.get("/evaluation/comparison", {
      params: { session_id: sessionId },
    });
    return data;
  },

  getModelDiagnostics: async (modelKey: string, sessionId: string = "default"): Promise<ModelDiagnosticsResponse> => {
    const { data } = await apiClient.get(`/evaluation/diagnostics/${encodeURIComponent(modelKey)}`, {
      params: { session_id: sessionId },
    });
    return data;
  },

  // Report URLs for direct download links
  getHtmlReportUrl: (sessionId: string = "default") => `${API_BASE_URL}/reports/html?session_id=${sessionId}`,
  getJsonReportUrl: (sessionId: string = "default") => `${API_BASE_URL}/reports/json?session_id=${sessionId}`,
  getMarkdownReportUrl: (sessionId: string = "default") => `${API_BASE_URL}/reports/markdown?session_id=${sessionId}`,
  getModelDownloadUrl: (modelKey: string, sessionId: string = "default") =>
    `${API_BASE_URL}/reports/model/${encodeURIComponent(modelKey)}?session_id=${sessionId}`,
  getDatasetCsvUrl: (sessionId: string = "default") => `${API_BASE_URL}/reports/dataset-csv?session_id=${sessionId}`,
};
