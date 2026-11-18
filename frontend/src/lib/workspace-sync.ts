/**
 * OpenDataLens — Workspace Auto-Save and Synchronization Engine
 * Phase 7.1: Local Persistence & Auto-Save
 */

import { localDB, CompleteWorkspaceSnapshot, LocalWorkspaceMetadata } from "./indexeddb";
import { getWorkspaceId } from "./api";

export type SaveStatusState =
  | "idle"
  | "saving"
  | "saved"
  | "unsaved"
  | "offline_saved"
  | "unavailable"
  | "error";

export interface SaveStatusInfo {
  state: SaveStatusState;
  message: string;
  lastSavedAt: Date | null;
  workspaceName?: string;
}

type SaveStatusListener = (status: SaveStatusInfo) => void;

class WorkspaceSyncService {
  private listeners: Set<SaveStatusListener> = new Set();
  private debounceTimer: any = null;
  private isSaving: boolean = false;
  private hasPendingSave: boolean = false;
  private pendingSnapshot: Partial<CompleteWorkspaceSnapshot> | null = null;
  private lastSavedAt: Date | null = null;
  private currentState: SaveStatusState = "saved";
  private currentMessage: string = "All changes saved locally";

  constructor() {
    // Check IndexedDB availability on init
    if (typeof window !== "undefined") {
      if (!localDB.checkAvailability()) {
        this.currentState = "unavailable";
        this.currentMessage = "Local storage unavailable in this browser";
      }
    }
  }

  public subscribe(listener: SaveStatusListener): () => void {
    this.listeners.add(listener);
    listener({
      state: this.currentState,
      message: this.currentMessage,
      lastSavedAt: this.lastSavedAt,
    });
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const info: SaveStatusInfo = {
      state: this.currentState,
      message: this.currentMessage,
      lastSavedAt: this.lastSavedAt,
    };
    this.listeners.forEach((fn) => {
      try {
        fn(info);
      } catch (e) {
        console.error("Error in save status subscriber:", e);
      }
    });
  }

  private setStatus(state: SaveStatusState, message: string) {
    this.currentState = state;
    this.currentMessage = message;
    this.notify();
  }

  /**
   * Request an auto-save.
   * Debounced by 1000ms and batch-updated to prevent UI lag.
   */
  public queueAutoSave(partial: Partial<CompleteWorkspaceSnapshot>, debounceMs: number = 1000): void {
    if (!localDB.checkAvailability()) {
      this.setStatus("unavailable", "IndexedDB unavailable (private mode or disabled)");
      return;
    }

    this.setStatus("unsaved", "Unsaved changes");
    this.hasPendingSave = true;
    this.pendingSnapshot = {
      ...(this.pendingSnapshot || {}),
      ...partial,
    };

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.flushSave();
    }, debounceMs);
  }

  /**
   * Immediately flush pending changes to IndexedDB with write concurrency lock.
   */
  public async flushSave(): Promise<boolean> {
    if (!this.hasPendingSave || !this.pendingSnapshot) {
      return true;
    }

    if (this.isSaving) {
      // Re-trigger after current save finishes
      return false;
    }

    this.isSaving = true;
    this.setStatus("saving", "Saving to local browser storage...");

    const snapshotToSave = { ...this.pendingSnapshot };
    this.pendingSnapshot = null;
    this.hasPendingSave = false;
    let fullSnapshot: CompleteWorkspaceSnapshot | null = null;

    try {
      const workspaceId = getWorkspaceId();
      const existingMeta = await localDB.getWorkspaceMetadata(workspaceId);
      const existingDataset = await localDB.getDataset(workspaceId);

      // Merge dataset to preserve cached raw_csv and full records across partial updates
      let datasetToPersist = snapshotToSave.dataset;
      if (datasetToPersist) {
        if (!datasetToPersist.raw_csv && existingDataset?.raw_csv) {
          datasetToPersist = {
            ...existingDataset,
            ...datasetToPersist,
            raw_csv: existingDataset.raw_csv,
          };
        }
      } else if (existingDataset) {
        datasetToPersist = existingDataset;
      }

      const totalRows = datasetToPersist?.total_rows || existingMeta?.total_rows || 0;
      const totalCols = datasetToPersist?.total_cols || existingMeta?.total_cols || 0;
      const datasetName = datasetToPersist?.metadata?.name || existingMeta?.dataset_name || "Untitled Dataset";
      const memoryMB = datasetToPersist?.memory_mb || existingMeta?.memory_mb || 0;

      const updatedMeta: LocalWorkspaceMetadata = {
        id: workspaceId,
        name: existingMeta?.name || `Workspace (${datasetName})`,
        description: existingMeta?.description || "",
        created_at: existingMeta?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        dataset_name: datasetName,
        total_rows: totalRows,
        total_cols: totalCols,
        memory_mb: memoryMB,
        clean_steps_count: snapshotToSave.transformations?.history?.length ?? existingMeta?.clean_steps_count ?? 0,
        models_trained_count: snapshotToSave.model_results?.leaderboard?.length ?? existingMeta?.models_trained_count ?? 0,
        approx_size_bytes: Math.round(memoryMB * 1024 * 1024),
      };

      fullSnapshot = {
        metadata: updatedMeta,
        dataset: datasetToPersist,
        transformations: snapshotToSave.transformations,
        visualizations: snapshotToSave.visualizations,
        analysis_history: snapshotToSave.analysis_history,
        model_results: snapshotToSave.model_results,
      };

      await localDB.saveFullWorkspace(fullSnapshot);
      this.lastSavedAt = new Date();

      const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
      if (isOffline) {
        this.setStatus("offline_saved", "Offline — saved locally");
      } else {
        this.setStatus("saved", "All changes saved locally");
      }
      return true;
    } catch (err: any) {
      console.error("[WorkspaceSync] Failed to persist workspace to IndexedDB:", err);
      // Safe fallback on quota error: retry saving without heavy raw_csv
      if ((err.name === "QuotaExceededError" || err.message?.includes("quota")) && fullSnapshot && fullSnapshot.dataset?.raw_csv) {
        try {
          console.warn("[WorkspaceSync] Quota limit encountered. Retrying save with raw_csv omitted...");
          const degradedSnapshot: CompleteWorkspaceSnapshot = {
            ...fullSnapshot,
            dataset: {
              ...fullSnapshot.dataset,
              raw_csv: undefined,
            },
          };
          await localDB.saveFullWorkspace(degradedSnapshot);
          this.lastSavedAt = new Date();
          this.setStatus("error", "Storage quota limit reached. Saved preview schema; raw CSV omitted.");
          return true;
        } catch (retryErr) {
          console.error("[WorkspaceSync] Degraded save also failed:", retryErr);
        }
      }

      if (err.name === "QuotaExceededError") {
        this.setStatus("error", "Storage quota exceeded. Free up browser space.");
      } else {
        this.setStatus("error", `Save failed: ${err.message || "IndexedDB write error"}`);
      }
      return false;
    } finally {
      this.isSaving = false;
      // If new changes arrived while saving, queue another flush
      if (this.hasPendingSave) {
        setTimeout(() => this.flushSave(), 200);
      }
    }
  }

  /**
   * Export complete workspace snapshot as a clean downloadable JSON file.
   */
  public async exportWorkspaceJSON(workspaceId: string): Promise<void> {
    const data = await localDB.getFullWorkspace(workspaceId);
    if (!data) throw new Error("Workspace not found for export");

    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.metadata.name.replace(/[^a-zA-Z0-9_-]/g, "_")}_workspace.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Import complete workspace snapshot from JSON file.
   */
  public async importWorkspaceJSON(file: File): Promise<string> {
    const text = await file.text();
    let data: CompleteWorkspaceSnapshot;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Invalid JSON file. Please select a valid OpenDataLens workspace backup.");
    }

    if (!data.metadata || !data.metadata.id) {
      throw new Error("Unsupported workspace format. Missing workspace metadata.");
    }

    // Generate a fresh unique ID for the imported workspace to avoid accidental overwrites
    const freshId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `ws_${Date.now()}`;
    data.metadata.id = freshId;
    data.metadata.name = `${data.metadata.name} (Imported)`;
    data.metadata.updated_at = new Date().toISOString();

    if (data.dataset) data.dataset.workspace_id = freshId;
    if (data.transformations) data.transformations.workspace_id = freshId;
    if (data.visualizations) data.visualizations.workspace_id = freshId;
    if (data.analysis_history) data.analysis_history.workspace_id = freshId;
    if (data.model_results) data.model_results.workspace_id = freshId;

    await localDB.saveFullWorkspace(data);
    return freshId;
  }
}

export const workspaceSync = new WorkspaceSyncService();
