/**
 * OpenDataLens — Browser-based IndexedDB Storage Architecture
 * Phase 7.1: Local Persistence Engine
 * 
 * Provides robust, versioned, zero-cloud workspace persistence with quota management,
 * graceful offline capability, and safe error boundaries.
 */

export interface LocalWorkspaceMetadata {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  dataset_name: string;
  total_rows: number;
  total_cols: number;
  memory_mb: number;
  clean_steps_count: number;
  models_trained_count: number;
  approx_size_bytes: number;
}

export interface LocalDatasetRecord {
  workspace_id: string;
  metadata: Record<string, any>;
  columns: Array<{
    name: string;
    dtype: string;
    non_null_count: number;
    null_count: number;
    unique_count: number;
    sample_value?: string;
  }>;
  records: Record<string, any>[];
  total_rows: number;
  total_cols: number;
  memory_mb: number;
  raw_csv?: string | null;
  raw_csv_omitted_for_quota?: boolean;
  is_full_dataset?: boolean;
  is_preview_only?: boolean;
  updated_at: string;
}

export interface LocalTransformationsRecord {
  workspace_id: string;
  history: Array<{
    step: number;
    action: string;
    timestamp: number;
    rows: number;
    cols: number;
  }>;
  named_checkpoints: Record<string, any>;
  last_action: string | null;
  updated_at: string;
}

export interface LocalVisualizationsRecord {
  workspace_id: string;
  active_chart_type: string;
  x_axis_col: string;
  y_axis_col: string;
  aggregation: string;
  bins: number;
  bin_numeric: boolean;
  sort_by: string;
  top_n: number;
  saved_presets: Array<Record<string, any>>;
  updated_at: string;
}

export interface LocalAnalysisHistoryRecord {
  workspace_id: string;
  quality_overview?: Record<string, any>;
  quality_recommendations?: Array<Record<string, any>>;
  copilot_history?: Array<{
    role: "user" | "assistant";
    content: string;
    timestamp: string;
    insights?: Record<string, any>;
  }>;
  updated_at: string;
}

export interface LocalModelResultsRecord {
  workspace_id: string;
  problem_type?: string;
  target_col?: string;
  feature_cols?: string[];
  leaderboard?: Array<{
    model_name: string;
    metrics: Record<string, any>;
    fit_time: number;
  }>;
  experiments?: Array<Record<string, any>>;
  updated_at: string;
}

export interface CompleteWorkspaceSnapshot {
  metadata: LocalWorkspaceMetadata;
  dataset?: LocalDatasetRecord;
  transformations?: LocalTransformationsRecord;
  visualizations?: LocalVisualizationsRecord;
  analysis_history?: LocalAnalysisHistoryRecord;
  model_results?: LocalModelResultsRecord;
}

const DB_NAME = "OpenDataLensDB";
const DB_VERSION = 1;

class IndexedDBStorageService {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<IDBDatabase> | null = null;
  private isAvailable: boolean = true;

  constructor() {
    if (typeof window === "undefined" || !window.indexedDB) {
      this.isAvailable = false;
    }
  }

  public checkAvailability(): boolean {
    return this.isAvailable && typeof window !== "undefined" && !!window.indexedDB;
  }

  /**
   * Initializes or upgrades the OpenDataLens IndexedDB database.
   */
  public async getDB(): Promise<IDBDatabase> {
    if (!this.checkAvailability()) {
      throw new Error("IndexedDB is not available in this environment.");
    }

    if (this.db) {
      return this.db;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise<IDBDatabase>((resolve, reject) => {
      try {
        const req = window.indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = (e: IDBVersionChangeEvent) => {
          const db = (e.target as IDBOpenDBRequest).result;

          // 1. Workspaces metadata store
          if (!db.objectStoreNames.contains("workspaces")) {
            const wsStore = db.createObjectStore("workspaces", { keyPath: "id" });
            wsStore.createIndex("updated_at", "updated_at", { unique: false });
            wsStore.createIndex("name", "name", { unique: false });
          }

          // 2. Datasets store
          if (!db.objectStoreNames.contains("datasets")) {
            db.createObjectStore("datasets", { keyPath: "workspace_id" });
          }

          // 3. Transformations store
          if (!db.objectStoreNames.contains("transformations")) {
            db.createObjectStore("transformations", { keyPath: "workspace_id" });
          }

          // 4. Visualizations store
          if (!db.objectStoreNames.contains("visualizations")) {
            db.createObjectStore("visualizations", { keyPath: "workspace_id" });
          }

          // 5. Analysis History store
          if (!db.objectStoreNames.contains("analysis_history")) {
            db.createObjectStore("analysis_history", { keyPath: "workspace_id" });
          }

          // 6. Model Results store
          if (!db.objectStoreNames.contains("model_results")) {
            db.createObjectStore("model_results", { keyPath: "workspace_id" });
          }
        };

        req.onsuccess = (e: Event) => {
          this.db = (e.target as IDBOpenDBRequest).result;
          this.db.onversionchange = () => {
            this.db?.close();
            this.db = null;
            this.initPromise = null;
          };
          resolve(this.db);
        };

        req.onerror = () => {
          this.isAvailable = false;
          reject(req.error || new Error("Failed to open IndexedDB"));
        };

        req.onblocked = () => {
          console.warn("IndexedDB open request blocked by another open tab.");
        };
      } catch (err) {
        this.isAvailable = false;
        reject(err);
      }
    });

    return this.initPromise;
  }

  // --- WORKSPACE METADATA CRUD ---

  public async listWorkspaces(): Promise<LocalWorkspaceMetadata[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("workspaces", "readonly");
      const store = tx.objectStore("workspaces");
      const index = store.index("updated_at");
      const req = index.openCursor(null, "prev"); // newest first
      const results: LocalWorkspaceMetadata[] = [];

      req.onsuccess = (e: Event) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };

      req.onerror = () => reject(req.error);
    });
  }

  public async getWorkspaceMetadata(id: string): Promise<LocalWorkspaceMetadata | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("workspaces", "readonly");
      const req = tx.objectStore("workspaces").get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  public async saveWorkspaceMetadata(meta: LocalWorkspaceMetadata): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("workspaces", "readwrite");
      const req = tx.objectStore("workspaces").put(meta);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async deleteWorkspace(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(
        ["workspaces", "datasets", "transformations", "visualizations", "analysis_history", "model_results"],
        "readwrite"
      );

      tx.objectStore("workspaces").delete(id);
      tx.objectStore("datasets").delete(id);
      tx.objectStore("transformations").delete(id);
      tx.objectStore("visualizations").delete(id);
      tx.objectStore("analysis_history").delete(id);
      tx.objectStore("model_results").delete(id);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- DATASET CRUD ---

  public async saveDataset(record: LocalDatasetRecord): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("datasets", "readwrite");
      const req = tx.objectStore("datasets").put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async getDataset(workspaceId: string): Promise<LocalDatasetRecord | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("datasets", "readonly");
      const req = tx.objectStore("datasets").get(workspaceId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  // --- TRANSFORMATIONS CRUD ---

  public async saveTransformations(record: LocalTransformationsRecord): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("transformations", "readwrite");
      const req = tx.objectStore("transformations").put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async getTransformations(workspaceId: string): Promise<LocalTransformationsRecord | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("transformations", "readonly");
      const req = tx.objectStore("transformations").get(workspaceId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  // --- VISUALIZATIONS CRUD ---

  public async saveVisualizations(record: LocalVisualizationsRecord): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("visualizations", "readwrite");
      const req = tx.objectStore("visualizations").put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async getVisualizations(workspaceId: string): Promise<LocalVisualizationsRecord | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("visualizations", "readonly");
      const req = tx.objectStore("visualizations").get(workspaceId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  // --- ANALYSIS HISTORY CRUD ---

  public async saveAnalysisHistory(record: LocalAnalysisHistoryRecord): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("analysis_history", "readwrite");
      const req = tx.objectStore("analysis_history").put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async getAnalysisHistory(workspaceId: string): Promise<LocalAnalysisHistoryRecord | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("analysis_history", "readonly");
      const req = tx.objectStore("analysis_history").get(workspaceId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  // --- MODEL RESULTS CRUD ---

  public async saveModelResults(record: LocalModelResultsRecord): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("model_results", "readwrite");
      const req = tx.objectStore("model_results").put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async getModelResults(workspaceId: string): Promise<LocalModelResultsRecord | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("model_results", "readonly");
      const req = tx.objectStore("model_results").get(workspaceId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  // --- ATOMIC COMPLETE WORKSPACE SNAPSHOT ---

  public async saveFullWorkspace(snapshot: CompleteWorkspaceSnapshot): Promise<void> {
    const db = await this.getDB();
    const id = snapshot.metadata.id;

    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(
          ["workspaces", "datasets", "transformations", "visualizations", "analysis_history", "model_results"],
          "readwrite"
        );

        tx.objectStore("workspaces").put(snapshot.metadata);

        if (snapshot.dataset) {
          tx.objectStore("datasets").put({ ...snapshot.dataset, workspace_id: id });
        }
        if (snapshot.transformations) {
          tx.objectStore("transformations").put({ ...snapshot.transformations, workspace_id: id });
        }
        if (snapshot.visualizations) {
          tx.objectStore("visualizations").put({ ...snapshot.visualizations, workspace_id: id });
        }
        if (snapshot.analysis_history) {
          tx.objectStore("analysis_history").put({ ...snapshot.analysis_history, workspace_id: id });
        }
        if (snapshot.model_results) {
          tx.objectStore("model_results").put({ ...snapshot.model_results, workspace_id: id });
        }

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(new Error("Transaction was aborted"));
      } catch (err) {
        reject(err);
      }
    });
  }

  public async getFullWorkspace(workspaceId: string): Promise<CompleteWorkspaceSnapshot | null> {
    const meta = await this.getWorkspaceMetadata(workspaceId);
    if (!meta) return null;

    const [dataset, transformations, visualizations, analysis_history, model_results] = await Promise.all([
      this.getDataset(workspaceId),
      this.getTransformations(workspaceId),
      this.getVisualizations(workspaceId),
      this.getAnalysisHistory(workspaceId),
      this.getModelResults(workspaceId),
    ]);

    return {
      metadata: meta,
      dataset: dataset || undefined,
      transformations: transformations || undefined,
      visualizations: visualizations || undefined,
      analysis_history: analysis_history || undefined,
      model_results: model_results || undefined,
    };
  }

  // --- STORAGE USAGE & QUOTA ESTIMATION ---

  public async getStorageEstimate(): Promise<{ usageMB: number; quotaMB: number; percentUsed: number; supported: boolean }> {
    if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.estimate) {
      try {
        const est = await navigator.storage.estimate();
        const usageBytes = est.usage || 0;
        const quotaBytes = est.quota || (1024 * 1024 * 1024); // default 1 GB estimate
        const usageMB = Math.round((usageBytes / (1024 * 1024)) * 100) / 100;
        const quotaMB = Math.round((quotaBytes / (1024 * 1024)) * 100) / 100;
        const percentUsed = quotaMB > 0 ? Math.min(100, Math.round((usageMB / quotaMB) * 100)) : 0;
        return { usageMB, quotaMB, percentUsed, supported: true };
      } catch {
        // Fallback
      }
    }
    return { usageMB: 0, quotaMB: 0, percentUsed: 0, supported: false };
  }

  public async clearAllWorkspaceData(): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(
        ["workspaces", "datasets", "transformations", "visualizations", "analysis_history", "model_results"],
        "readwrite"
      );

      tx.objectStore("workspaces").clear();
      tx.objectStore("datasets").clear();
      tx.objectStore("transformations").clear();
      tx.objectStore("visualizations").clear();
      tx.objectStore("analysis_history").clear();
      tx.objectStore("model_results").clear();

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export const localDB = new IndexedDBStorageService();

if (typeof window !== "undefined") {
  (window as any).__opendatalens_localDB = localDB;
}

