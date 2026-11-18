/**
 * OpenDataLens — Shared Page-Level Workspace Restoration Engine
 * Phase 7.1 & 7.2: Offline & Local Persistence Fallback Engine
 * 
 * Guarantees that when the backend is offline, unreachable, or cold-starting,
 * pages can restore cached datasets, schemas, cleaning history, chart configurations,
 * and ML leaderboard states directly from browser IndexedDB.
 */

import {
  localDB,
  LocalDatasetRecord,
  LocalTransformationsRecord,
  LocalVisualizationsRecord,
  LocalAnalysisHistoryRecord,
  LocalModelResultsRecord,
} from "./indexeddb";
import { getWorkspaceId } from "./api";

export interface RestoredWorkspaceState {
  isOffline: boolean;
  hasCachedData: boolean;
  workspaceId: string;
  dataset: LocalDatasetRecord | null;
  transformations: LocalTransformationsRecord | null;
  visualizations: LocalVisualizationsRecord | null;
  analysisHistory: LocalAnalysisHistoryRecord | null;
  modelResults: LocalModelResultsRecord | null;
  noticeMessage: string | null;
}

/**
 * Loads the active workspace from IndexedDB.
 * Used as a reliable fallback across all analytics pages when the backend is sleeping or unreachable.
 */
export async function loadActiveWorkspace(workspaceId?: string): Promise<RestoredWorkspaceState> {
  const sid = workspaceId || getWorkspaceId();
  const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

  try {
    const full = await localDB.getFullWorkspace(sid);
    if (!full || !full.dataset) {
      return {
        isOffline,
        hasCachedData: false,
        workspaceId: sid,
        dataset: null,
        transformations: null,
        visualizations: null,
        analysisHistory: null,
        modelResults: null,
        noticeMessage: null,
      };
    }

    return {
      isOffline,
      hasCachedData: true,
      workspaceId: sid,
      dataset: full.dataset,
      transformations: full.transformations || null,
      visualizations: full.visualizations || null,
      analysisHistory: full.analysis_history || null,
      modelResults: full.model_results || null,
      noticeMessage: "Workspace loaded from local browser cache. Backend connection required for new computations.",
    };
  } catch (err) {
    console.warn("[WorkspaceRestore] Could not load workspace from IndexedDB:", err);
    return {
      isOffline,
      hasCachedData: false,
      workspaceId: sid,
      dataset: null,
      transformations: null,
      visualizations: null,
      analysisHistory: null,
      modelResults: null,
      noticeMessage: null,
    };
  }
}
