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
  CopilotResponse,
  ColumnDistributionResponse,
  ApiErrorType,
  CategorizedError,
  ColdStartStatus,
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

// --- Cold Start & Reliability State Management ---
let isBackendAwake = false;
let isWakingUp = false;
let activeRequestCount = 0;
let wakingTimer: ReturnType<typeof setTimeout> | null = null;
const coldStartListeners = new Set<(status: ColdStartStatus) => void>();

export function subscribeColdStart(listener: (status: ColdStartStatus) => void): () => void {
  coldStartListeners.add(listener);
  listener({
    isWaking: isWakingUp,
    message: isWakingUp ? "Waking up the backend. This may take up to 50 seconds." : "",
    isOnline: isBackendAwake,
  });
  return () => {
    coldStartListeners.delete(listener);
  };
}

export function getColdStartStatus(): ColdStartStatus {
  return {
    isWaking: isWakingUp,
    message: isWakingUp ? "Waking up the backend. This may take up to 50 seconds." : "",
    isOnline: isBackendAwake,
  };
}

export function setBackendAwake(awake: boolean) {
  isBackendAwake = awake;
  if (awake) {
    isWakingUp = false;
    if (wakingTimer) {
      clearTimeout(wakingTimer);
      wakingTimer = null;
    }
    broadcastColdStart(false, "", true);
  }
}

function broadcastColdStart(isWaking: boolean, message: string = "", isOnline: boolean = isBackendAwake) {
  isWakingUp = isWaking;
  coldStartListeners.forEach((fn) => {
    try {
      fn({ isWaking, message, isOnline });
    } catch (e) {
      console.error("Cold start listener error", e);
    }
  });
}

/**
 * Distinguishes between a Render free-tier cold start, a client network timeout,
 * an offline connection, and a genuine FastAPI application error.
 */
export function categorizeApiError(error: any): CategorizedError {
  // 1. Client offline
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return {
      type: "offline",
      message: "You appear to be offline. Please verify your internet connection.",
      canRetry: true,
    };
  }

  // 2. Client-side network timeout (exceeded 75s)
  if (error?.code === "ECONNABORTED" || error?.message?.toLowerCase().includes("timeout")) {
    return {
      type: "timeout",
      message: "The request timed out after 75s. The backend may still be starting up. Please retry in a few moments.",
      canRetry: true,
    };
  }

  const status = error?.response?.status;

  // 3. Render Edge Gateway cold start responses (502, 503, 504) or network reset while spinning up
  if (status === 502 || status === 503 || status === 504 || (!error?.response && error?.isAxiosError)) {
    return {
      type: "cold_start",
      message: "Waking up the backend. This may take up to 50 seconds on Render's free tier.",
      statusCode: status,
      canRetry: true,
    };
  }

  // 4. Genuine FastAPI response with structured error detail
  if (error?.response?.data) {
    const detail = error.response.data.detail || error.response.data.message;
    const msg = typeof detail === "string" ? detail : (detail ? JSON.stringify(detail) : "API request failed with error.");
    return {
      type: "api_error",
      message: msg,
      statusCode: status,
      canRetry: false,
    };
  }

  // 5. Fallback
  return {
    type: "unknown",
    message: error?.message || "An unexpected error occurred communicating with the server.",
    statusCode: status,
    canRetry: true,
  };
}

// 75-second timeout to allow Render free tier ample time to complete container cold-start spinup
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 75000,
});

// Automatically inject unique workspace session ID header into every request
apiClient.interceptors.request.use((config) => {
  const currentWorkspaceId = getWorkspaceId();
  config.headers["X-Session-ID"] = currentWorkspaceId;

  activeRequestCount++;
  // If backend is not yet confirmed awake and timer is not yet set, start 3.5s waking detector
  if (!isBackendAwake && !wakingTimer) {
    wakingTimer = setTimeout(() => {
      if (!isBackendAwake && activeRequestCount > 0) {
        broadcastColdStart(true, "Waking up the backend. This may take up to 50 seconds.");
      }
    }, 3500);
  }

  return config;
});

// Response interceptor with safe idempotent GET retry logic
apiClient.interceptors.response.use(
  (response) => {
    activeRequestCount = Math.max(0, activeRequestCount - 1);
    if (!isBackendAwake) {
      isBackendAwake = true;
      if (wakingTimer) {
        clearTimeout(wakingTimer);
        wakingTimer = null;
      }
      broadcastColdStart(false, "", true);
    } else if (activeRequestCount === 0 && isWakingUp) {
      broadcastColdStart(false, "", true);
    }
    return response;
  },
  async (error) => {
    activeRequestCount = Math.max(0, activeRequestCount - 1);
    const config = error.config as (typeof error.config & { _retryCount?: number }) | undefined;

    // Safe retry criteria:
    // 1. MUST be an idempotent GET request.
    //    NEVER automatically retry POST, PUT, or DELETE to prevent duplicate uploads, sessions, or training runs.
    // 2. Error indicates Render cold start (502, 503, 504, or network error before response).
    // 3. Max retry count is 2.
    const isGet = (config?.method || "").toLowerCase() === "get";
    const status = error?.response?.status;
    const isColdStart = status === 502 || status === 503 || status === 504 || (!error?.response && error?.isAxiosError);

    if (isGet && isColdStart && config && (config._retryCount || 0) < 2) {
      config._retryCount = (config._retryCount || 0) + 1;
      broadcastColdStart(true, "Waking up the backend. This may take up to 50 seconds.");

      const delayMs = config._retryCount === 1 ? 3000 : 5000;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return apiClient(config);
    }

    if (activeRequestCount === 0) {
      if (wakingTimer) {
        clearTimeout(wakingTimer);
        wakingTimer = null;
      }
      if (isWakingUp && !isBackendAwake) {
        broadcastColdStart(false, "", false);
      }
    }

    return Promise.reject(error);
  }
);

export const api = {
  // Health & Cold-Start Wakeup Verification
  getHealth: async () => {
    const { data } = await apiClient.get("/health");
    return data;
  },

  verifyHealthWithWakeup: async (
    maxWaitMs: number = 75000,
    pollIntervalMs: number = 3000,
    onProgress?: (elapsedSec: number, statusText: string) => void
  ): Promise<boolean> => {
    const startTime = Date.now();
    broadcastColdStart(true, "Waking up the backend. This may take up to 50 seconds.");

    while (Date.now() - startTime < maxWaitMs) {
      const elapsedSec = Math.round((Date.now() - startTime) / 1000);
      if (onProgress) {
        onProgress(elapsedSec, "Waking up the backend. This may take up to 50 seconds.");
      }

      try {
        const res = await axios.get(`${API_BASE_URL}/health`, {
          timeout: 8000,
          headers: { "Cache-Control": "no-cache" },
        });
        if (res.data && (res.data.status === "ok" || res.data.status === "operational")) {
          isBackendAwake = true;
          broadcastColdStart(false, "", true);
          return true;
        }
      } catch {
        // Backend is still spinning up on Render
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    broadcastColdStart(false, "", false);
    return false;
  },

  categorizeError: categorizeApiError,

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

  getColumnDistribution: async (column: string, sessionId?: string): Promise<ColumnDistributionResponse> => {
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
